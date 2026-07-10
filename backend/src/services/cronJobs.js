const cron = require('node-cron');
const User = require('../models/User');
const { sendMail } = require('./emailService');
const { syncAllUsers } = require('./priceSyncService');
const { holdingInvestedValue, holdingCurrentValue } = require('../utils/financeMath');

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmtINR(n) {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtPct(n) {
  return (n >= 0 ? '+' : '') + (Number(n) || 0).toFixed(2) + '%';
}

// ---------------------------------------------------------------------------
// Month-end email: total daily-spends for the month that just finished, and
// the OVERALL portfolio profit/loss figure only — deliberately no holdings
// breakdown and no net-worth/total-balance number, per how this app is
// meant to be used.
// ---------------------------------------------------------------------------
async function sendMonthlySummaries() {
  const now = new Date();
  const finishedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // previous month
  const mk = monthKey(finishedMonth);

  const users = await User.find({ lastMonthlyEmailSentFor: { $ne: mk } });

  for (const user of users) {
    const monthExpenses = user.expenses.filter((e) => e.date.slice(0, 7) === mk);
    const totalSpend = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const invested = user.holdings.reduce((s, h) => s + holdingInvestedValue(h), 0);
    const current = user.holdings.reduce((s, h) => s + holdingCurrentValue(h), 0);
    const pl = current - invested;
    const plPct = invested ? (pl / invested) * 100 : 0;

    const monthLabel = finishedMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="font-family: Georgia, serif;">Your ${monthLabel} summary</h2>
        <p>Here's your monthly recap from Finance Tracker — just the two numbers you asked to be kept in the loop on.</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 12px; background:#F8F8F6; border:1px solid #e2e2e2;">Total spent this month</td>
            <td style="padding: 12px; background:#F8F8F6; border:1px solid #e2e2e2; text-align:right; font-weight:bold;">${fmtINR(totalSpend)}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border:1px solid #e2e2e2;">Overall investment P/L</td>
            <td style="padding: 12px; border:1px solid #e2e2e2; text-align:right; font-weight:bold; color:${pl >= 0 ? '#276B47' : '#AE4A2C'};">${fmtINR(pl)} (${fmtPct(plPct)})</td>
          </tr>
        </table>
        <p style="color:#888; font-size:12px; margin-top:24px;">Log in to Finance Tracker for the full breakdown. You're receiving this because month-end summaries are enabled on your account.</p>
      </div>
    `;

    await sendMail({
      to: user.email,
      subject: `Your ${monthLabel} spending & P/L summary`,
      html,
      text: `Total spent this month: ${fmtINR(totalSpend)}. Overall investment P/L: ${fmtINR(pl)} (${fmtPct(plPct)}).`,
    });

    user.lastMonthlyEmailSentFor = mk;
    await user.save();
  }

  if (users.length) console.log(`[cron] Sent monthly summary to ${users.length} user(s) for ${mk}.`);
}

// ---------------------------------------------------------------------------
// Insurance / deadline reminders: anything due within 60 days gets emailed,
// re-sent every ~25 days while still inside that window so it doesn't get lost.
// ---------------------------------------------------------------------------
async function sendDeadlineReminders() {
  const users = await User.find({ 'insurance.0': { $exists: true } });
  const now = new Date();

  for (const user of users) {
    const dueSoon = [];
    for (const policy of user.insurance) {
      if (!policy.dueDate) continue;
      const daysLeft = Math.ceil((new Date(policy.dueDate) - now) / 86400000);
      if (daysLeft < 0 || daysLeft > 60) continue;
      const daysSinceReminder = policy.lastReminderSentAt ? (now - policy.lastReminderSentAt) / 86400000 : Infinity;
      if (daysSinceReminder < 25) continue;
      dueSoon.push({ policy, daysLeft });
    }
    if (!dueSoon.length) continue;

    const rows = dueSoon
      .map(
        ({ policy, daysLeft }) =>
          `<tr><td style="padding:10px;border:1px solid #e2e2e2;">${policy.name} (${policy.type})</td><td style="padding:10px;border:1px solid #e2e2e2;text-align:right;">${policy.dueDate} · ${daysLeft}d left</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="font-family: Georgia, serif;">Upcoming renewals</h2>
        <p>These are coming up within the next 2 months:</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 12px;">${rows}</table>
        <p style="color:#888; font-size:12px; margin-top:24px;">Log in to Finance Tracker to update or renew these.</p>
      </div>
    `;

    await sendMail({
      to: user.email,
      subject: `${dueSoon.length} renewal(s) coming up`,
      html,
      text: dueSoon.map(({ policy, daysLeft }) => `${policy.name}: due ${policy.dueDate} (${daysLeft} days left)`).join('\n'),
    });

    for (const { policy } of dueSoon) policy.lastReminderSentAt = now;
    await user.save();
  }
}

function startCronJobs() {
  // Once a day, after both NSE market close and AMFI's daily NAV publish —
  // this is an end-of-day sync, never real-time, by design.
  cron.schedule('30 20 * * *', () => {
    syncAllUsers().catch((err) => console.error('[cron] price sync failed:', err));
  });

  cron.schedule('0 8 * * *', () => {
    sendMonthlySummaries().catch((err) => console.error('[cron] monthly summary failed:', err));
    sendDeadlineReminders().catch((err) => console.error('[cron] deadline reminders failed:', err));
  });

  console.log('[cron] Scheduled: price sync daily at 20:30, email checks daily at 08:00 (server time).');
}

module.exports = { startCronJobs, sendMonthlySummaries, sendDeadlineReminders };

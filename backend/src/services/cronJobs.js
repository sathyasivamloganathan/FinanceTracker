const cron = require('node-cron');
const User = require('../models/User');
const { sendMail } = require('./emailService');
const { syncAllUsers } = require('./priceSyncService');
const { holdingInvestedValue, holdingCurrentValue } = require('../utils/financeMath');

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function weekKey(d) {
  // ISO week number
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function fmtINR(n) {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtPct(n) {
  return (n >= 0 ? '+' : '') + (Number(n) || 0).toFixed(2) + '%';
}

// ---------------------------------------------------------------------------
// Monthly summary email
// ---------------------------------------------------------------------------
async function sendMonthlySummaries() {
  const now = new Date();
  const finishedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mk = monthKey(finishedMonth);

  const users = await User.find({ lastMonthlyEmailSentFor: { $ne: mk } });

  for (const user of users) {
    const monthExpenses = user.expenses.filter((e) => e.date.slice(0, 7) === mk && (e.expenseType === 'expense' || !e.expenseType));
    const totalSpend = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // By category
    const byCat = {};
    monthExpenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
    const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([cat, amt]) => `<tr><td style="padding:8px;border:1px solid #e2e2e2;">${cat}</td><td style="padding:8px;border:1px solid #e2e2e2;text-align:right;">${fmtINR(amt)}</td></tr>`)
      .join('');

    const invested = user.holdings.reduce((s, h) => s + holdingInvestedValue(h), 0);
    const current = user.holdings.reduce((s, h) => s + holdingCurrentValue(h), 0);
    const pl = current - invested;
    const plPct = invested ? (pl / invested) * 100 : 0;

    const monthLabel = finishedMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const html = `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #0B1220;">
        <h2 style="font-family: Georgia, serif; margin-bottom: 4px;">Your ${monthLabel} summary</h2>
        <p style="color:#6B7280; font-size:13px;">Monthly recap from your Finance Tracker.</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding:12px;background:#F8F8F6;border:1px solid #e2e2e2;">Total spent this month</td>
            <td style="padding:12px;background:#F8F8F6;border:1px solid #e2e2e2;text-align:right;font-weight:bold;">${fmtINR(totalSpend)}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #e2e2e2;">Overall investment P/L</td>
            <td style="padding:12px;border:1px solid #e2e2e2;text-align:right;font-weight:bold;color:${pl >= 0 ? '#059669' : '#DC2626'};">${fmtINR(pl)} (${fmtPct(plPct)})</td>
          </tr>
        </table>
        ${catRows ? `
        <h3 style="margin-top:20px;margin-bottom:8px;font-size:14px;">Top spend categories</h3>
        <table style="width:100%; border-collapse: collapse;">${catRows}</table>` : ''}
        <p style="color:#888; font-size:12px; margin-top:24px;">Log in to your Finance Tracker for the full breakdown.</p>
      </div>
    `;

    try {
      await sendMail({
        to: user.email,
        subject: `Your ${monthLabel} spending & P/L summary`,
        html,
        text: `Total spent: ${fmtINR(totalSpend)}. Investment P/L: ${fmtINR(pl)} (${fmtPct(plPct)}).`,
      });
      user.lastMonthlyEmailSentFor = mk;
      await user.save();
      console.log(`[cron] Monthly summary sent to ${user.email} for ${mk}`);
    } catch (err) {
      console.error(`[cron] Failed to send monthly summary to ${user.email}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Weekly summary email (every Monday)
// ---------------------------------------------------------------------------
async function sendWeeklySummaries() {
  const now = new Date();
  const wk = weekKey(now);

  const users = await User.find({ lastWeeklyEmailSentFor: { $ne: wk } });

  for (const user of users) {
    // Last 7 days expenses
    const cutoff = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
    const weekExpenses = user.expenses.filter((e) => e.date >= cutoff && (e.expenseType === 'expense' || !e.expenseType));
    const totalSpend = weekExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    if (totalSpend === 0) continue; // skip if nothing to report

    const byCat = {};
    weekExpenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
    const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `<tr><td style="padding:8px;border:1px solid #e2e2e2;">${cat}</td><td style="padding:8px;border:1px solid #e2e2e2;text-align:right;">${fmtINR(amt)}</td></tr>`)
      .join('');

    const invested = user.holdings.reduce((s, h) => s + holdingInvestedValue(h), 0);
    const current = user.holdings.reduce((s, h) => s + holdingCurrentValue(h), 0);
    const pl = current - invested;
    const plPct = invested ? (pl / invested) * 100 : 0;

    const weekLabel = `${cutoff} to ${now.toISOString().slice(0, 10)}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #0B1220;">
        <h2 style="font-family: Georgia, serif; margin-bottom: 4px;">Your weekly spend summary</h2>
        <p style="color:#6B7280; font-size:13px;">${weekLabel}</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding:12px;background:#F8F8F6;border:1px solid #e2e2e2;">Total spent this week</td>
            <td style="padding:12px;background:#F8F8F6;border:1px solid #e2e2e2;text-align:right;font-weight:bold;">${fmtINR(totalSpend)}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #e2e2e2;">Overall investment P/L</td>
            <td style="padding:12px;border:1px solid #e2e2e2;text-align:right;font-weight:bold;color:${pl >= 0 ? '#059669' : '#DC2626'};">${fmtINR(pl)} (${fmtPct(plPct)})</td>
          </tr>
        </table>
        ${catRows ? `
        <h3 style="margin-top:20px;margin-bottom:8px;font-size:14px;">By category</h3>
        <table style="width:100%; border-collapse: collapse;">${catRows}</table>` : ''}
        <p style="color:#888; font-size:12px; margin-top:24px;">Log in to your Finance Tracker to view details.</p>
      </div>
    `;

    try {
      await sendMail({
        to: user.email,
        subject: `Weekly spend: ${fmtINR(totalSpend)} this week`,
        html,
        text: `Total this week: ${fmtINR(totalSpend)}. Investment P/L: ${fmtINR(pl)} (${fmtPct(plPct)}).`,
      });
      user.lastWeeklyEmailSentFor = wk;
      await user.save();
      console.log(`[cron] Weekly summary sent to ${user.email} for week ${wk}`);
    } catch (err) {
      console.error(`[cron] Failed to send weekly summary to ${user.email}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// FD maturity auto-processing
// ---------------------------------------------------------------------------
async function processMatureFDs() {
  const today = new Date().toISOString().slice(0, 10);
  const users = await User.find({ 'fds.0': { $exists: true } });

  for (const user of users) {
    let changed = false;
    for (const fd of user.fds) {
      if (fd.status !== 'active') continue;
      if (fd.maturityDate > today) continue;

      changed = true;
      if (fd.autoRenew) {
        // Calculate new tenure same as original
        const start = new Date(fd.startDate);
        const end = new Date(fd.maturityDate);
        const tenureDays = Math.round((end - start) / 86400000);
        const newStart = today;
        const newEnd = new Date(Date.now() + tenureDays * 86400000).toISOString().slice(0, 10);
        const r = fd.interestRate / 100;
        const years = tenureDays / 365.25;
        const n = { 'Monthly': 12, 'Quarterly': 4, 'Half-yearly': 2, 'Yearly': 1, 'On maturity': 1 }[fd.compounding] || 4;
        const newMaturity = fd.compounding === 'On maturity'
          ? fd.maturityAmount * (1 + r * years)
          : fd.maturityAmount * Math.pow(1 + r / n, n * years);

        fd.status = 'renewed';
        user.fds.push({
          bankName: fd.bankName, accountId: fd.accountId,
          principal: fd.maturityAmount, interestRate: fd.interestRate,
          startDate: newStart, maturityDate: newEnd,
          maturityAmount: Math.round(newMaturity * 100) / 100,
          compounding: fd.compounding, autoRenew: fd.autoRenew,
          creditToAccountId: fd.creditToAccountId, status: 'active',
          notes: `Auto-renewed from ${fd.bankName}`,
        });

        await sendMail({
          to: user.email,
          subject: `FD Auto-Renewed: ${fd.bankName} — ${fmtINR(fd.maturityAmount)}`,
          html: `<p>Your FD with ${fd.bankName} matured on ${fd.maturityDate} and was automatically renewed for the same tenure. New maturity date: ${newEnd}. New principal: ${fmtINR(fd.maturityAmount)}.</p>`,
          text: `FD auto-renewed: ${fd.bankName}, new maturity: ${newEnd}.`,
        }).catch(console.error);
      } else {
        fd.status = 'matured';
        if (fd.creditToAccountId) {
          const acct = user.bankAccounts.id(fd.creditToAccountId);
          if (acct) { acct.balance += fd.maturityAmount; acct.updatedAt = today; }
        }
        await sendMail({
          to: user.email,
          subject: `FD Matured: ${fd.bankName} — ${fmtINR(fd.maturityAmount)}`,
          html: `<p>Your FD with ${fd.bankName} matured today (${today}). Amount: ${fmtINR(fd.maturityAmount)}. ${fd.creditToAccountId ? 'It has been credited to your linked account.' : 'Please collect or renew manually.'}</p>`,
          text: `FD matured: ${fd.bankName}, amount: ${fmtINR(fd.maturityAmount)}.`,
        }).catch(console.error);
      }
    }
    if (changed) await user.save();
  }
}

// ---------------------------------------------------------------------------
// Insurance / deadline reminders
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
      .map(({ policy, daysLeft }) =>
        `<tr><td style="padding:10px;border:1px solid #e2e2e2;">${policy.name} (${policy.type})</td><td style="padding:10px;border:1px solid #e2e2e2;text-align:right;">${policy.dueDate} · ${daysLeft}d left</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="font-family: Georgia, serif;">Upcoming renewals</h2>
        <p>These are coming up within the next 2 months:</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 12px;">${rows}</table>
        <p style="color:#888; font-size:12px; margin-top:24px;">Log in to update or renew these.</p>
      </div>
    `;

    try {
      await sendMail({
        to: user.email,
        subject: `${dueSoon.length} renewal(s) coming up`,
        html,
        text: dueSoon.map(({ policy, daysLeft }) => `${policy.name}: due ${policy.dueDate} (${daysLeft} days left)`).join('\n'),
      });
      for (const { policy } of dueSoon) policy.lastReminderSentAt = now;
      await user.save();
    } catch (err) {
      console.error(`[cron] Failed to send reminder to ${user.email}:`, err.message);
    }
  }
}


// ---------------------------------------------------------------------------
// Generate recurring transactions daily
// ---------------------------------------------------------------------------
async function generateRecurringForAll() {
  const User = require('../models/User');
  const users = await User.find({ 'recurring.0': { $exists: true } });
  const today = new Date().toISOString().slice(0, 10);

  for (const user of users) {
    let changed = false;
    for (const r of user.recurring) {
      if (!r.active) continue;
      if (r.endDate && r.endDate < today) continue;

      const base = r.lastGeneratedDate || r.startDate;
      let cursor = new Date(base);
      const end = new Date(today);
      let safety = 0;

      while (cursor <= end && safety < 12) {
        const dateStr = cursor.toISOString().slice(0, 10);
        if (dateStr > r.startDate && dateStr <= today) {
          const tag = `[recurring:${String(r._id)}]`;
          const exists = user.expenses.some(e => e.description && e.description.includes(tag) && e.date === dateStr);
          if (!exists) {
            user.expenses.push({
              date: dateStr, category: r.category,
              description: `${r.name} ${tag}`,
              amount: r.amount, accountId: r.accountId || '',
              expenseType: r.type === 'income' ? 'income' : 'expense',
            });
            r.lastGeneratedDate = dateStr;
            user.markModified('recurring');
            changed = true;
          }
        }
        // advance cursor
        const n = new Date(cursor);
        if (r.frequency === 'daily') n.setDate(n.getDate() + 1);
        else if (r.frequency === 'weekly') n.setDate(n.getDate() + 7);
        else if (r.frequency === 'fortnightly') n.setDate(n.getDate() + 14);
        else if (r.frequency === 'monthly') n.setMonth(n.getMonth() + 1);
        else if (r.frequency === 'quarterly') n.setMonth(n.getMonth() + 3);
        else if (r.frequency === 'yearly') n.setFullYear(n.getFullYear() + 1);
        cursor = n;
        safety++;
      }
    }
    if (changed) await user.save();
  }
  console.log('[cron] Recurring generation done');
}


// ---------------------------------------------------------------------------
// FD monthly interest payout (for monthly compounding FDs)
// ---------------------------------------------------------------------------
async function processFDInterestPayouts() {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const users = await User.find({ 'fds.0': { $exists: true } });

  for (const user of users) {
    let changed = false;
    for (const fd of user.fds) {
      if (fd.status !== 'active') continue;
      if (fd.compounding !== 'Monthly' && fd.compounding !== 'Quarterly' && fd.compounding !== 'Half-yearly' && fd.compounding !== 'Yearly') continue;

      const n = { Monthly: 12, Quarterly: 4, 'Half-yearly': 2, Yearly: 1 }[fd.compounding];
      // Check if it's time for next payout based on frequency
      const startDate = new Date(fd.startDate);
      const nowDate = new Date(today);
      const monthsSinceStart = (nowDate.getFullYear() - startDate.getFullYear()) * 12 + (nowDate.getMonth() - startDate.getMonth());
      const payoutMonths = Math.round(12 / n); // e.g. Monthly=1, Quarterly=3
      if (monthsSinceStart % payoutMonths !== 0) continue;

      // Check not already paid this cycle
      const lastPaidKey = `fd_interest_${String(fd._id)}_${thisMonth}`;
      const alreadyPaid = user.expenses && user.expenses.some(e => e.description && e.description.includes(lastPaidKey));
      if (alreadyPaid) continue;

      // Calculate period interest
      const principal = Number(fd.principal);
      const r = Number(fd.interestRate) / 100;
      const periodInterest = Math.round((principal * r / n) * 100) / 100;
      if (periodInterest <= 0) continue;

      // Log as income entry
      user.expenses.push({
        date: today,
        category: 'Interest',
        description: `FD interest — ${fd.bankName} [${lastPaidKey}]`,
        amount: periodInterest,
        accountId: fd.creditToAccountId || '',
        expenseType: 'income',
      });

      // Credit to linked account if set
      if (fd.creditToAccountId) {
        const acct = user.bankAccounts.id(fd.creditToAccountId);
        if (acct) { acct.balance += periodInterest; acct.updatedAt = today; }
      }

      changed = true;
    }
    if (changed) await user.save();
  }
}

function startCronJobs() {
  // Price sync daily at 20:30
  cron.schedule('30 20 * * *', () => {
    syncAllUsers().catch((err) => console.error('[cron] price sync failed:', err));
  });

  // Daily checks at 08:00
  cron.schedule('0 8 * * *', () => {
    sendMonthlySummaries().catch((err) => console.error('[cron] monthly summary failed:', err));
    sendDeadlineReminders().catch((err) => console.error('[cron] deadline reminders failed:', err));
    processMatureFDs().catch((err) => console.error('[cron] FD maturity check failed:', err));
    generateRecurringForAll().catch((err) => console.error('[cron] recurring generation failed:', err));
    processFDInterestPayouts().catch((err) => console.error('[cron] FD interest payout failed:', err));
  });

  // Weekly summary every Monday at 08:00
  cron.schedule('0 8 * * 1', () => {
    sendWeeklySummaries().catch((err) => console.error('[cron] weekly summary failed:', err));
  });

  console.log('[cron] Scheduled: price sync at 20:30, daily checks at 08:00, weekly summary on Mondays at 08:00.');
}

module.exports = { startCronJobs, sendMonthlySummaries, sendWeeklySummaries, sendDeadlineReminders };

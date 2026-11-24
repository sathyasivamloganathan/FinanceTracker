const cron = require('node-cron');
const User = require('../models/User');
const { getConfig } = require('../config/env');
const { sendMail, isEmailEnabled, marketingParts, wrap } = require('./emailService');
const { syncAllUsers } = require('./priceSyncService');
const { runExclusive } = require('./jobRunner');
const { withUser } = require('./withUser');
const { closeFd } = require('../utils/fd');
const { generateRecurringForUser } = require('../utils/recurring');
const { computeNetWorth, holdingInvestedValue, holdingCurrentValue } = require('../utils/financeMath');
const { APP_TZ, todayStr, addDays, addMonthsClamped, daysBetween, nextDueOnOrAfter, isoWeekKey } = require('../utils/dates');
const { esc } = require('../utils/html');
const { round2 } = require('../utils/money');

const fmtINR = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtPct = (n) => (n >= 0 ? '+' : '') + (Number(n) || 0).toFixed(2) + '%';
const cell = 'padding:8px;border:1px solid #e2e2e2;';
const row = (a, b) => `<tr><td style="${cell}">${esc(a)}</td><td style="${cell}text-align:right;">${esc(b)}</td></tr>`;
const isSpend = (e) => e.expenseType === 'expense' || !e.expenseType;

// Run fn for every user matching the query — one user at a time, each in its
// own try/catch so a single bad document can never abort the whole job, and
// without ever holding more than one user in memory.
async function forEachUser(query, fn) {
  const cursor = User.find(query).select('_id').lean().cursor();
  let ok = 0; let failed = 0;
  for await (const { _id } of cursor) {
    try { await fn(String(_id)); ok += 1; }
    catch (e) { failed += 1; console.error(`[jobs] user ${_id} failed:`, e.message); }
  }
  return { ok, failed };
}

// Only verified addresses that haven't opted out get automated mail.
const canMail = (user, pref) => isEmailEnabled() && user.emailVerified && user.emailPrefs?.[pref] !== false;

async function sendAutomated(user, subject, innerHtml, text) {
  const m = marketingParts(user);
  await sendMail({
    to: user.email, subject, html: wrap(innerHtml + m.footerHtml), text: text + m.footerText, headers: m.headers,
  });
}

// ── FD maturity ──────────────────────────────────────────────────────
async function processMatureFDs(today = todayStr()) {
  await forEachUser({ fds: { $elemMatch: { status: 'active', maturityDate: { $lte: today } } } }, async (id) => {
    const info = await withUser(id, (user) => {
      const events = [];
      for (const fd of user.fds.filter((f) => f.status === 'active' && f.maturityDate <= today)) {
        const bank = fd.bankName;
        const r = closeFd(user, fd, today);
        events.push({ bank, ...r });
      }
      return { events, email: user.email, name: user.name, _id: user._id, emailVerified: user.emailVerified, emailPrefs: user.emailPrefs };
    });
    if (!info || !info.events.length || !canMail(info, 'reminders')) return;
    const lines = info.events.map((e) => e.kind === 'renewed'
      ? `${e.bank}: renewed automatically with ${fmtINR(e.amount)}`
      : `${e.bank}: matured — ${fmtINR(e.amount)} credited`);
    await sendAutomated(info, 'Your fixed deposit has matured',
      `<h2>Fixed deposit update</h2><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
      lines.join('\n'));
  });
}

// ── Recurring entries (same code path as the API button) ─────────────
async function generateRecurringForAll(today = todayStr()) {
  await forEachUser({ 'recurring.active': true }, (id) => withUser(id, (user) => generateRecurringForUser(user, today)));
}

// ── Insurance reminders ──────────────────────────────────────────────
async function sendDeadlineReminders(today = todayStr()) {
  if (!isEmailEnabled()) return;
  await forEachUser({ 'insurance.0': { $exists: true }, emailVerified: true, 'emailPrefs.reminders': { $ne: false } }, async (id) => {
    const info = await withUser(id, (user) => {
      const due = [];
      for (const p of user.insurance) {
        const next = nextDueOnOrAfter(p.dueDate, p.frequency, today); // ignores malformed dates; rolls recurring premiums forward
        if (!next) continue;
        const daysLeft = daysBetween(today, next);
        if (daysLeft > 60) continue;
        if (p.lastReminderSentAt && (Date.now() - p.lastReminderSentAt.getTime()) < 25 * 86400000) continue;
        due.push({ id: String(p._id), name: p.name, daysLeft, next, premium: p.premium });
      }
      return { due, email: user.email, name: user.name, _id: user._id, emailVerified: user.emailVerified, emailPrefs: user.emailPrefs };
    });
    if (!info || !info.due.length) return;
    const lines = info.due.map((d) => `${d.name} — due ${d.next} (${d.daysLeft === 0 ? 'today' : `in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`})${d.premium ? `, premium ${fmtINR(d.premium)}` : ''}`);
    await sendAutomated(info, 'Insurance premium reminder',
      `<h2>Upcoming premiums</h2><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`, lines.join('\n'));
    await withUser(id, (user) => { info.due.forEach((d) => { const p = user.insurance.id(d.id); if (p) p.lastReminderSentAt = new Date(); }); });
  });
}

// ── Monthly summary ──────────────────────────────────────────────────
async function sendMonthlySummaries(today = todayStr()) {
  if (!isEmailEnabled()) return;
  const mk = addMonthsClamped(`${today.slice(0, 7)}-01`, -1).slice(0, 7); // the month that just finished
  const monthStart = `${mk}-01`;
  const monthEnd = addDays(addMonthsClamped(monthStart, 1), -1);
  const label = new Date(`${monthStart}T00:00:00Z`).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  await forEachUser({ lastMonthlyEmailSentFor: { $ne: mk }, emailVerified: true, 'emailPrefs.monthly': { $ne: false } }, async (id) => {
    const info = await withUser(id, (user) => {
      // Nothing to report → mark as handled so we don't re-check every day.
      if (todayStr(APP_TZ, user.createdAt) > monthEnd) { user.lastMonthlyEmailSentFor = mk; return null; } // joined after that month ended
      const spends = user.expenses.filter((e) => e.date.slice(0, 7) === mk && isSpend(e));
      if (!spends.length && !user.holdings.length) { user.lastMonthlyEmailSentFor = mk; return null; }
      const byCat = {};
      spends.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
      const invested = user.holdings.reduce((s, h) => s + holdingInvestedValue(h), 0);
      const current = user.holdings.reduce((s, h) => s + holdingCurrentValue(h), 0);
      return {
        total: spends.reduce((s, e) => s + Number(e.amount || 0), 0),
        top: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5),
        pl: current - invested, plPct: invested ? ((current - invested) / invested) * 100 : 0,
        netWorth: computeNetWorth(user, today).netWorth,
        email: user.email, name: user.name, _id: user._id, emailVerified: user.emailVerified, emailPrefs: user.emailPrefs,
      };
    });
    if (!info) return;
    const html = `<h2 style="margin-bottom:4px">Your ${esc(label)} summary</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">${row('Total spent', fmtINR(info.total))}${row('Portfolio P/L', `${fmtINR(info.pl)} (${fmtPct(info.plPct)})`)}${row('Net worth today', fmtINR(info.netWorth))}</table>
      ${info.top.length ? `<h3>Top categories</h3><table style="width:100%;border-collapse:collapse">${info.top.map(([c, a]) => row(c, fmtINR(a))).join('')}</table>` : ''}`;
    await sendAutomated(info, `Your ${label} summary`, html, `${label}: spent ${fmtINR(info.total)}, net worth ${fmtINR(info.netWorth)}`);
    // Mark only after the mail was accepted by SMTP: a failed send is retried on the next run.
    await withUser(id, (user) => { user.lastMonthlyEmailSentFor = mk; });
  });
}

// ── Weekly summary ───────────────────────────────────────────────────
async function sendWeeklySummaries(today = todayStr()) {
  if (!isEmailEnabled()) return;
  const wk = isoWeekKey(today);
  const from = addDays(today, -6); // exactly the last 7 days, today included
  await forEachUser({ lastWeeklyEmailSentFor: { $ne: wk }, emailVerified: true, 'emailPrefs.weekly': { $ne: false } }, async (id) => {
    const info = await withUser(id, (user) => {
      const spends = user.expenses.filter((e) => e.date >= from && e.date <= today && isSpend(e));
      const total = spends.reduce((s, e) => s + Number(e.amount || 0), 0);
      if (!total) { user.lastWeeklyEmailSentFor = wk; return null; }
      const byCat = {};
      spends.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
      return { total, top: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5), email: user.email, name: user.name, _id: user._id, emailVerified: user.emailVerified, emailPrefs: user.emailPrefs };
    });
    if (!info) return;
    await sendAutomated(info, 'Your week in spending',
      `<h2>Last 7 days</h2><table style="width:100%;border-collapse:collapse">${row('Total spent', fmtINR(info.total))}${info.top.map(([c, a]) => row(c, fmtINR(a))).join('')}</table>`,
      `Last 7 days: spent ${fmtINR(info.total)}`);
    await withUser(id, (user) => { user.lastWeeklyEmailSentFor = wk; });
  });
}

const weekdayOf = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sunday … 1 = Monday

// Every job is wrapped so one failing job never stops the others.
async function runSteps(steps, today) {
  for (const [name, fn] of steps) {
    try { await fn(today); } catch (e) { console.error(`[jobs] ${name} failed:`, e.stack || e.message); }
  }
}

// DATA jobs: change balances / create entries. (FD maturity also e-mails its own notice.)
const DATA_STEPS = [['fd-maturity', processMatureFDs], ['recurring', generateRecurringForAll]];
// E-MAIL jobs: reminders + summaries. Safe to run on their own schedule / host.
const EMAIL_STEPS = [['reminders', sendDeadlineReminders], ['monthly', sendMonthlySummaries]];

// Each run takes a MongoDB lease so overlapping runs / several instances never duplicate work.
const runDataJobs = () => runExclusive('data-jobs', () => runSteps(DATA_STEPS, todayStr()), 2 * 60 * 60 * 1000);
const runEmailJobs = () => runExclusive('email-jobs', async () => {
  const today = todayStr();
  await runSteps(EMAIL_STEPS, today);
  if (weekdayOf(today) === 1) await runSteps([['weekly', sendWeeklySummaries]], today); // Mondays
}, 60 * 60 * 1000);
const runDailyJobs = async () => { await runDataJobs(); await runEmailJobs(); };
const runWeeklyJobs = () => runExclusive('weekly-jobs', () => sendWeeklySummaries(), 60 * 60 * 1000);
const runPriceSync = () => runExclusive('price-sync', () => syncAllUsers(), 2 * 60 * 60 * 1000);

let tasks = [];
function startCronJobs() {
  if (!getConfig().runJobs) { console.log('[jobs] disabled (RUN_JOBS=false)'); return; }
  const opts = { timezone: APP_TZ };
  tasks = [
    cron.schedule('30 20 * * *', runPriceSync, opts),   // 20:30 — after market close
    cron.schedule('0 8 * * *', runDailyJobs, opts),     // 08:00
    cron.schedule('5 8 * * 1', runWeeklyJobs, opts),    // Monday 08:05
  ];
  console.log(`[jobs] scheduled (timezone ${APP_TZ})`);
}
function stopCronJobs() { tasks.forEach((t) => t.stop()); tasks = []; }

module.exports = {
  startCronJobs, stopCronJobs, runDailyJobs, runDataJobs, runEmailJobs, runWeeklyJobs, runPriceSync,
  processMatureFDs, generateRecurringForAll, sendDeadlineReminders, sendMonthlySummaries, sendWeeklySummaries,
};

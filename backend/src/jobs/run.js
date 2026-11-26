#!/usr/bin/env node
/*
 * Stand-alone job runner - run scheduled work from ANY scheduler (Azure WebJob /
 * Container Apps job, GitHub Actions cron, Render/Railway cron, system cron) instead
 * of inside the web server. Set RUN_JOBS=false on the web app so it doesn't also run them.
 *
 *   node src/jobs/run.js emails            reminders + monthly summary (+ weekly summary on Mondays)
 *   node src/jobs/run.js data              FD maturity + recurring entries
 *   node src/jobs/run.js daily             data, then emails
 *   node src/jobs/run.js price-sync        refresh stock / mutual-fund prices
 *   node src/jobs/run.js smtp-check        verify SMTP login (sends nothing)
 *   node src/jobs/run.js test-email you@x  send one real test message, printing the true error if it fails
 */
require('dotenv').config();
const { getConfig } = require('../config/env');

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  getConfig(); // validates env, exits with a clear message otherwise

  const { connectDB, disconnectDB } = require('../config/db');
  const jobs = require('../services/cronJobs');
  const mail = require('../services/emailService');

  const table = {
    emails: jobs.runEmailJobs, data: jobs.runDataJobs, daily: jobs.runDailyJobs, weekly: jobs.runWeeklyJobs, 'price-sync': jobs.runPriceSync,
  };

  if (cmd === 'smtp-check') {
    const r = await mail.verifySmtp();
    console.log(r.ok ? 'SMTP login OK' : `SMTP FAILED: ${r.error}`);
    process.exitCode = r.ok ? 0 : 1;
    return;
  }
  if (cmd === 'test-email') {
    if (!arg) throw new Error('usage: node src/jobs/run.js test-email you@example.com');
    const v = await mail.verifySmtp();
    if (!v.ok) { console.log(`SMTP FAILED: ${v.error}`); process.exitCode = 1; return; }
    const info = await mail.sendMail({ to: arg, subject: 'FinanceTracer test e-mail', text: 'If you can read this, SMTP works.', html: '<p>If you can read this, SMTP works.</p>' });
    console.log('Accepted by SMTP server:', JSON.stringify({ accepted: info.accepted, rejected: info.rejected, response: info.response }));
    return;
  }
  if (!table[cmd]) { console.error(`Unknown job "${cmd}". Use: ${Object.keys(table).join(', ')}, smtp-check, test-email`); process.exitCode = 2; return; }

  await connectDB();
  try { await table[cmd](); } finally { await disconnectDB(); }
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error('[job-runner]', e.message); process.exit(1); });

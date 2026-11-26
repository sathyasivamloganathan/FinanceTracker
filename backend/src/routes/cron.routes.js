// HTTP triggers for scheduled jobs — built for hosted schedulers such as
// cron-job.org that can only "call a URL".
//
//   GET|POST /api/cron/<job>        job = emails | data | daily | weekly | price-sync
//   Authorization: Bearer <CRON_SECRET>      (or header  X-Cron-Secret: <CRON_SECRET>)
//
// cron-job.org gives up after ~30 s, so the endpoint answers 202 immediately and
// the job keeps running in the background (guarded by the MongoDB lease lock, so
// a repeated call never runs the same job twice at once).
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getConfig } = require('../config/env');
const { safeEqual } = require('../utils/tokens');
const { ipKey } = require('../utils/ip');

const router = express.Router();

// Resolved at call time so the job functions can be stubbed in tests.
const JOBS = {
  emails: (j) => j.runEmailJobs,
  data: (j) => j.runDataJobs,
  daily: (j) => j.runDailyJobs,
  weekly: (j) => j.runWeeklyJobs,
  'price-sync': (j) => j.runPriceSync,
};

// Wrong-secret guessing is throttled per client IP.
const failLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, keyGenerator: ipKey, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts' },
});

function presentedSecret(req) {
  const h = req.get('authorization') || '';
  if (/^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, '').trim();
  return (req.get('x-cron-secret') || '').trim();
}

function handler(req, res) {
  const secret = getConfig().cronSecret;
  if (!secret) return res.status(404).json({ error: 'Not found' }); // endpoint disabled until CRON_SECRET is set
  const given = presentedSecret(req);
  if (!given || !safeEqual(given, secret)) return res.status(401).json({ error: 'Unauthorized' });

  const pick = JOBS[req.params.job];
  if (!pick) return res.status(404).json({ error: `Unknown job. Use one of: ${Object.keys(JOBS).join(', ')}` });

  const run = pick(require('../services/cronJobs'));
  const startedAt = new Date().toISOString();
  setImmediate(() => {
    Promise.resolve().then(run).catch((e) => console.error(`[cron-http] ${req.params.job} failed:`, e.stack || e.message));
  });
  res.status(202).json({ started: true, job: req.params.job, at: startedAt });
}

router.get('/:job', failLimiter, handler);
router.post('/:job', failLimiter, handler);

module.exports = router;

const express = require('express');
const cookieParser = require('cookie-parser');
const { securityPre, securityPost, generalLimiter, writeLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');
const { isDbReady } = require('./config/db');

function createApp() {
  const app = express();
  securityPre(app);                                   // helmet, CORS, trust proxy
  app.use(express.json({ limit: '100kb', strict: true })); // JSON only — no urlencoded parser on purpose
  app.use(cookieParser());
  securityPost(app);                                  // mongo-sanitize + hpp (need the parsed body) + CSRF guard
  app.use(generalLimiter);

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/ready', (req, res) => (isDbReady() ? res.json({ ok: true }) : res.status(503).json({ ok: false })));

  app.use('/api/cron',          require('./routes/cron.routes'));   // secret-protected triggers for external schedulers
  app.use('/api/auth',          require('./routes/auth.routes'));
  app.use('/api/data',          requireAuth, require('./routes/data.routes'));
  app.use('/api/holdings',      requireAuth, writeLimiter, require('./routes/holdings.routes'));
  app.use('/api/transactions',  requireAuth, writeLimiter, require('./routes/transactions.routes'));
  app.use('/api/expenses',      requireAuth, writeLimiter, require('./routes/expenses.routes'));
  app.use('/api/insurance',     requireAuth, writeLimiter, require('./routes/insurance.routes'));
  app.use('/api/assets',        requireAuth, writeLimiter, require('./routes/assets.routes'));
  app.use('/api/targets',       requireAuth, writeLimiter, require('./routes/targets.routes'));
  app.use('/api/liabilities',   requireAuth, writeLimiter, require('./routes/liabilities.routes'));
  app.use('/api/goals',         requireAuth, writeLimiter, require('./routes/goals.routes'));
  app.use('/api/snapshots',     requireAuth, writeLimiter, require('./routes/snapshots.routes'));
  app.use('/api/export',        requireAuth, require('./routes/export.routes'));
  app.use('/api/profile',       requireAuth, writeLimiter, require('./routes/profile.routes'));
  app.use('/api/bank-accounts', requireAuth, writeLimiter, require('./routes/bankAccounts.routes'));
  app.use('/api/fds',           requireAuth, writeLimiter, require('./routes/fds.routes'));
  app.use('/api/recurring',     requireAuth, writeLimiter, require('./routes/recurring.routes'));
  app.use('/api/budget',        requireAuth, writeLimiter, require('./routes/budget.routes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

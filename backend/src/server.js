require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { applySecurity, generalLimiter, writeLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');
const { startCronJobs } = require('./services/cronJobs');

const authRoutes         = require('./routes/auth.routes');
const dataRoutes         = require('./routes/data.routes');
const holdingsRoutes     = require('./routes/holdings.routes');
const transactionsRoutes = require('./routes/transactions.routes');
const expensesRoutes     = require('./routes/expenses.routes');
const insuranceRoutes    = require('./routes/insurance.routes');
const assetsRoutes       = require('./routes/assets.routes');
const targetsRoutes      = require('./routes/targets.routes');
const liabilitiesRoutes  = require('./routes/liabilities.routes');
const goalsRoutes        = require('./routes/goals.routes');
const snapshotsRoutes    = require('./routes/snapshots.routes');
const exportRoutes       = require('./routes/export.routes');
const profileRoutes      = require('./routes/profile.routes');
const bankAccountsRoutes = require('./routes/bankAccounts.routes');
const fdsRoutes          = require('./routes/fds.routes');
const recurringRoutes    = require('./routes/recurring.routes');
const budgetRoutes       = require('./routes/budget.routes');

const app = express();
applySecurity(app);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(generalLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api/auth',          authRoutes);
app.use('/api/data',          requireAuth, dataRoutes);
app.use('/api/holdings',      requireAuth, writeLimiter, holdingsRoutes);
app.use('/api/transactions',  requireAuth, writeLimiter, transactionsRoutes);
app.use('/api/expenses',      requireAuth, writeLimiter, expensesRoutes);
app.use('/api/insurance',     requireAuth, writeLimiter, insuranceRoutes);
app.use('/api/assets',        requireAuth, writeLimiter, assetsRoutes);
app.use('/api/targets',       requireAuth, writeLimiter, targetsRoutes);
app.use('/api/liabilities',   requireAuth, writeLimiter, liabilitiesRoutes);
app.use('/api/goals',         requireAuth, writeLimiter, goalsRoutes);
app.use('/api/snapshots',     requireAuth, writeLimiter, snapshotsRoutes);
app.use('/api/export',        requireAuth, exportRoutes);
app.use('/api/profile',       requireAuth, writeLimiter, profileRoutes);
app.use('/api/bank-accounts', requireAuth, writeLimiter, bankAccountsRoutes);
app.use('/api/fds',           requireAuth, writeLimiter, fdsRoutes);
app.use('/api/recurring',     requireAuth, writeLimiter, recurringRoutes);
app.use('/api/budget',        requireAuth, writeLimiter, budgetRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
    startCronJobs();
  });
  const graceful = (sig) => { console.log(`[server] ${sig}`); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000); };
  process.once('SIGTERM', () => graceful('SIGTERM'));
  process.once('SIGINT',  () => graceful('SIGINT'));
}).catch((err) => { console.error('[server] Failed to start:', err.message); process.exit(1); });

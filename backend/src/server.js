require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { applySecurity, generalLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');
const { startCronJobs } = require('./services/cronJobs');

const authRoutes = require('./routes/auth.routes');
const dataRoutes = require('./routes/data.routes');
const holdingsRoutes = require('./routes/holdings.routes');
const transactionsRoutes = require('./routes/transactions.routes');
const expensesRoutes = require('./routes/expenses.routes');
const insuranceRoutes = require('./routes/insurance.routes');
const assetsRoutes = require('./routes/assets.routes');
const targetsRoutes = require('./routes/targets.routes');
const liabilitiesRoutes = require('./routes/liabilities.routes');
const goalsRoutes = require('./routes/goals.routes');
const snapshotsRoutes = require('./routes/snapshots.routes');
const exportRoutes = require('./routes/export.routes');
const profileRoutes = require('./routes/profile.routes');

const app = express();
app.set("trust proxy", true);

applySecurity(app);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(generalLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);

// Everything below requires a valid session.
app.use('/api/data', requireAuth, dataRoutes);
app.use('/api/holdings', requireAuth, holdingsRoutes);
app.use('/api/transactions', requireAuth, transactionsRoutes);
app.use('/api/expenses', requireAuth, expensesRoutes);
app.use('/api/insurance', requireAuth, insuranceRoutes);
app.use('/api/assets', requireAuth, assetsRoutes);
app.use('/api/targets', requireAuth, targetsRoutes);
app.use('/api/liabilities', requireAuth, liabilitiesRoutes);
app.use('/api/goals', requireAuth, goalsRoutes);
app.use('/api/snapshots', requireAuth, snapshotsRoutes);
app.use('/api/export', requireAuth, exportRoutes);
app.use('/api/profile', requireAuth, profileRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] Listening on port ${PORT}`);
      startCronJobs();
    });
  })
  .catch((err) => {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  });

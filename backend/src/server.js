require('dotenv').config();
const { getConfig } = require('./config/env');

let cfg;
try {
  cfg = getConfig(); // fail fast on a weak/missing secret or bad config
} catch (err) {
  console.error('[server]', err.message);
  process.exit(1);
}

const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');
const { startCronJobs, stopCronJobs } = require('./services/cronJobs');

let server;
let shuttingDown = false;

async function shutdown(signal, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} — shutting down`);
  const force = setTimeout(() => { console.error('[server] forced exit'); process.exit(1); }, 15000);
  force.unref();
  try {
    stopCronJobs();
    if (server) await new Promise((resolve) => server.close(resolve)); // let in-flight requests finish
    await disconnectDB();
  } catch (e) {
    console.error('[server] error during shutdown:', e.message);
    code = 1;
  }
  process.exit(code);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('[server] unhandledRejection:', reason instanceof Error ? reason.stack : reason));
process.on('uncaughtException', (err) => { console.error('[server] uncaughtException:', err.stack || err.message); shutdown('uncaughtException', 1); });

connectDB()
  .then(() => {
    server = createApp().listen(cfg.port, () => {
      console.log(`[server] listening on ${cfg.port}`);
      startCronJobs();
    });
  })
  .catch((err) => { console.error('[server] failed to start:', err.message); process.exit(1); });

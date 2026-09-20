const mongoose = require('mongoose');

// Retry configuration — on transient network blips Mongoose will attempt
// reconnection automatically; we surface errors to the console but do NOT
// crash the process (process.exit here would lose buffered writes).
const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 10000,  // fail fast if MongoDB is unreachable at startup
  socketTimeoutMS: 45000,           // idle socket timeout
  maxPoolSize: 10,                  // connection pool ceiling
  minPoolSize: 2,                   // keep at least 2 connections warm
  heartbeatFrequencyMS: 10000,      // check server health every 10 s
  retryWrites: true,                // auto-retry eligible write operations once
  w: 'majority',                    // wait for majority acknowledgement before confirming writes
  journal: true,                    // wait for journal flush — strongest durability guarantee
};

let retryCount = 0;
const MAX_RETRIES = 5;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  }

  mongoose.set('strictQuery', true);   // reject unknown fields at the schema level
  mongoose.set('strict', true);        // belt-and-suspenders: also enforced per-schema

  try {
    await mongoose.connect(uri, CONNECT_OPTIONS);
    console.log('[db] Connected to MongoDB');
    retryCount = 0;
  } catch (err) {
    retryCount++;
    console.error(`[db] Initial connection failed (attempt ${retryCount}/${MAX_RETRIES}):`, err.message);
    if (retryCount < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // exponential back-off, cap 30 s
      console.log(`[db] Retrying in ${delay / 1000}s…`);
      await new Promise((r) => setTimeout(r, delay));
      return connectDB();
    }
    throw err; // give up after MAX_RETRIES — let the process crash cleanly
  }

  // ── Connection event listeners ──────────────────────────────────────
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err.message);
    // Mongoose handles reconnection internally; just log here.
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected — Mongoose will attempt to reconnect.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[db] MongoDB reconnected.');
  });

  mongoose.connection.on('close', () => {
    console.log('[db] MongoDB connection closed.');
  });

  // ── Graceful shutdown ───────────────────────────────────────────────
  // Ensures in-flight writes complete before the process exits on
  // SIGTERM (Docker stop) or SIGINT (Ctrl-C). Without this, a rolling
  // deploy or restart mid-save could leave a document half-written.
  const graceful = async (signal) => {
    console.log(`[db] ${signal} received — closing MongoDB connection…`);
    try {
      await mongoose.connection.close(false); // false = don't force-close
      console.log('[db] Connection closed cleanly.');
    } catch (e) {
      console.error('[db] Error during graceful shutdown:', e.message);
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => graceful('SIGTERM'));
  process.once('SIGINT',  () => graceful('SIGINT'));
}

module.exports = connectDB;

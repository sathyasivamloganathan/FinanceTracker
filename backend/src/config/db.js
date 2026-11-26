const mongoose = require('mongoose');

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  w: 'majority',
  journal: true,
};

const MAX_RETRIES = 5;
let listenersAttached = false;

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('error', (err) => console.error('[db] connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected - driver will reconnect'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
}

// Idempotent one-time data migrations for databases created by v1.0.
async function migrate() {
  const users = mongoose.connection.collection('users');
  // Explicit nulls broke the unique googleId index (2nd local user failed).
  await users.updateMany({ googleId: null }, { $unset: { googleId: '' } });
  try { await users.dropIndex('googleId_1'); } catch { /* already gone */ }
  try {
    await users.createIndex({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } }, name: 'googleId_partial_unique' });
  } catch (e) { console.warn('[db] googleId index:', e.message); }
  // passwordHash is no longer loaded by default; track presence explicitly.
  await users.updateMany({ passwordHash: { $type: 'string' }, hasPassword: { $ne: true } }, { $set: { hasPassword: true } });
  // Accounts that existed before e-mail verification are grandfathered in.
  await users.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
  await users.updateMany({ tokenVersion: { $exists: false } }, { $set: { tokenVersion: 0 } });
  // Older recurring entries carried a visible "[recurring:<id>]" suffix in their description.
  try { await require('../utils/legacy').migrateRecurringTags(); } catch (e) { console.error('[db] recurring-tag migration:', e.message); }
}

async function connectDB(attempt = 1) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  try {
    await mongoose.connect(uri, CONNECT_OPTIONS);
  } catch (err) {
    console.error(`[db] connection failed (attempt ${attempt}/${MAX_RETRIES}):`, err.message);
    if (attempt >= MAX_RETRIES) throw err;
    const delay = Math.min(1000 * 2 ** attempt, 30000);
    await new Promise((r) => setTimeout(r, delay));
    return connectDB(attempt + 1);
  }
  attachListeners();
  console.log('[db] connected');
  await migrate();
  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

const isDbReady = () => mongoose.connection.readyState === 1;

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
module.exports.isDbReady = isDbReady;

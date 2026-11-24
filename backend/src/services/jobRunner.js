const crypto = require('crypto');
const Lock = require('../models/Lock');

const INSTANCE_ID = crypto.randomBytes(8).toString('hex');

// Lease-based lock in MongoDB: when the API runs on several instances only
// one of them executes a given scheduled job at a time.
async function acquire(name, ttlMs) {
  const now = new Date();
  try {
    const doc = await Lock.findOneAndUpdate(
      { _id: name, expiresAt: { $lte: now } },
      { $set: { owner: INSTANCE_ID, expiresAt: new Date(now.getTime() + ttlMs) } },
      { upsert: true, new: true }
    );
    return !!doc && doc.owner === INSTANCE_ID;
  } catch (err) {
    if (err.code === 11000) return false; // someone else holds a live lease
    throw err;
  }
}

async function release(name) {
  await Lock.updateOne({ _id: name, owner: INSTANCE_ID }, { $set: { expiresAt: new Date(0) } }).catch(() => {});
}

async function runExclusive(name, fn, ttlMs = 60 * 60 * 1000) {
  let got = false;
  try { got = await acquire(name, ttlMs); } catch (e) { console.error(`[jobs] lock ${name} failed:`, e.message); return; }
  if (!got) { console.log(`[jobs] ${name}: another instance is running it — skipped`); return; }
  const t0 = Date.now();
  try {
    await fn();
    console.log(`[jobs] ${name} finished in ${Date.now() - t0}ms`);
  } catch (e) {
    console.error(`[jobs] ${name} failed:`, e.stack || e.message);
  } finally {
    await release(name);
  }
}

module.exports = { runExclusive, acquire, release, INSTANCE_ID };

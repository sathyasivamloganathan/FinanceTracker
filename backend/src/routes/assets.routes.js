const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const reply = (u) => ({ otherAssets: serializeList(u.otherAssets) });

// The asset's current amount is always the snapshot with the latest VALID date.
function recomputeAmountFromHistory(asset) {
  const valid = asset.history.filter((h) => V.isValidDateStr(h.date));
  if (!valid.length) return;
  const latest = valid.reduce((a, b) => (b.date >= a.date ? b : a));
  asset.amount = latest.amount;
}

function snapshotDate(v) {
  const d = V.date(v, { field: 'date', required: true });
  if (d > todayStr()) throw V.bad('Snapshot date cannot be in the future');
  return d;
}

router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  const today = todayStr();
  const amount = round2(V.num(b.amount, { field: 'amount', min: 0, max: 1e12 }) ?? 0);
  req.user.otherAssets.push({
    category: V.str(b.category, { field: 'category', required: true, max: 60 }),
    name: V.str(b.name, { field: 'name', required: true, max: 120 }),
    amount, updatedAt: today, history: [{ date: today, amount }],
  });
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

// Quick inline update - also records today's snapshot so history builds itself.
router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const asset = req.user.otherAssets.id(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  const b = V.body(req);
  const today = todayStr();
  if (b.name !== undefined) asset.name = V.str(b.name, { field: 'name', required: true, max: 120 });
  if (b.category !== undefined) asset.category = V.str(b.category, { field: 'category', required: true, max: 60 });
  if (b.amount !== undefined) {
    const amount = round2(V.num(b.amount, { field: 'amount', min: 0, max: 1e12, required: true }));
    const todays = asset.history.find((h) => h.date === today);
    if (todays) todays.amount = amount; else asset.history.push({ date: today, amount });
    recomputeAmountFromHistory(asset);
  }
  asset.updatedAt = today;
  await req.user.save();
  res.json(reply(req.user));
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  if (!req.user.otherAssets.id(req.params.id)) return res.status(404).json({ error: 'Asset not found' });
  req.user.otherAssets.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

router.post('/:id/snapshots', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const asset = req.user.otherAssets.id(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  const b = V.body(req);
  const date = snapshotDate(b.date);
  const amount = round2(V.num(b.amount, { field: 'amount', min: 0, max: 1e12, required: true }));
  const existing = asset.history.find((h) => h.date === date);
  if (existing) existing.amount = amount; else asset.history.push({ date, amount });
  recomputeAmountFromHistory(asset);
  asset.updatedAt = todayStr();
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

router.patch('/:id/snapshots/:snapshotId', mutating(async (req, res) => {
  V.objectId(req.params.id); V.objectId(req.params.snapshotId, 'snapshotId');
  const asset = req.user.otherAssets.id(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  const snap = asset.history.id(req.params.snapshotId);
  if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
  const b = V.body(req);
  if (b.date !== undefined) snap.date = snapshotDate(b.date);
  if (b.amount !== undefined) snap.amount = round2(V.num(b.amount, { field: 'amount', min: 0, max: 1e12, required: true }));
  recomputeAmountFromHistory(asset);
  await req.user.save();
  res.json(reply(req.user));
}));

router.delete('/:id/snapshots/:snapshotId', mutating(async (req, res) => {
  V.objectId(req.params.id); V.objectId(req.params.snapshotId, 'snapshotId');
  const asset = req.user.otherAssets.id(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  if (!asset.history.id(req.params.snapshotId)) return res.status(404).json({ error: 'Snapshot not found' });
  asset.history.pull({ _id: req.params.snapshotId });
  recomputeAmountFromHistory(asset);
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

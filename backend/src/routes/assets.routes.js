const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

function recomputeAmountFromHistory(asset) {
  if (!asset.history.length) return;
  const latest = [...asset.history].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  asset.amount = latest.amount;
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { category, name, amount } = req.body || {};
    if (!category || !name) return res.status(400).json({ error: 'category and name are required' });
    const today = new Date().toISOString().slice(0, 10);
    const amountNum = Number(amount) || 0;
    req.user.otherAssets.push({
      category: String(category).trim(),
      name: String(name).trim(),
      amount: amountNum,
      updatedAt: today,
      history: [{ date: today, amount: amountNum }],
    });
    await req.user.save();
    res.status(201).json({ otherAssets: serializeList(req.user.otherAssets) });
  })
);

// Quick single-value update (e.g. inline edit in the table) — this ALSO
// records a snapshot for today, so your monthly history builds itself even
// if you never open the dedicated history view.
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const asset = req.user.otherAssets.id(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const today = new Date().toISOString().slice(0, 10);
    const amountNum = Number(req.body.amount) || 0;
    asset.amount = amountNum;
    asset.updatedAt = today;
    const existingToday = asset.history.find((h) => h.date === today);
    if (existingToday) existingToday.amount = amountNum;
    else asset.history.push({ date: today, amount: amountNum });
    await req.user.save();
    res.json({ otherAssets: serializeList(req.user.otherAssets) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.otherAssets.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ otherAssets: serializeList(req.user.otherAssets) });
  })
);

// ---- Monthly history (snapshots) ----

router.post(
  '/:id/snapshots',
  asyncHandler(async (req, res) => {
    const asset = req.user.otherAssets.id(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const { date, amount } = req.body || {};
    if (!date) return res.status(400).json({ error: 'date is required' });
    const amountNum = Number(amount) || 0;
    const existing = asset.history.find((h) => h.date === date);
    if (existing) existing.amount = amountNum;
    else asset.history.push({ date, amount: amountNum });
    recomputeAmountFromHistory(asset);
    asset.updatedAt = new Date().toISOString().slice(0, 10);
    await req.user.save();
    res.status(201).json({ otherAssets: serializeList(req.user.otherAssets) });
  })
);

router.patch(
  '/:id/snapshots/:snapshotId',
  asyncHandler(async (req, res) => {
    const asset = req.user.otherAssets.id(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const snapshot = asset.history.id(req.params.snapshotId);
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
    const { date, amount } = req.body || {};
    if (date) snapshot.date = date;
    if (amount !== undefined) snapshot.amount = Number(amount) || 0;
    recomputeAmountFromHistory(asset);
    await req.user.save();
    res.json({ otherAssets: serializeList(req.user.otherAssets) });
  })
);

router.delete(
  '/:id/snapshots/:snapshotId',
  asyncHandler(async (req, res) => {
    const asset = req.user.otherAssets.id(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    asset.history.pull({ _id: req.params.snapshotId });
    recomputeAmountFromHistory(asset);
    await req.user.save();
    res.json({ otherAssets: serializeList(req.user.otherAssets) });
  })
);

module.exports = router;

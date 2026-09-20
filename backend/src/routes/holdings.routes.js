const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { syncHolding } = require('../services/priceSyncService');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, symbol, assetType, qty, avgRate, currentRate, autoSync } = req.body || {};
    if (!name || !assetType) return res.status(400).json({ error: 'name and assetType are required' });

    const existing = req.user.holdings.find(
      (h) => h.name.toLowerCase() === String(name).trim().toLowerCase() && h.assetType === assetType
    );
    if (existing) {
      return res.status(409).json({
        error: `You already have a holding named "${existing.name}". Log a transaction instead to add to it, or edit the existing one.`,
      });
    }

    req.user.holdings.push({
      name: String(name).trim(),
      symbol: symbol ? String(symbol).trim() : '',
      assetType,
      qty: Number(qty) || 0,
      avgRate: Number(avgRate) || 0,
      currentRate: Number(currentRate) || Number(avgRate) || 0,
      autoSync: autoSync !== false,
      lastSyncStatus: 'pending',
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    await req.user.save();
    res.status(201).json({ holdings: serializeList(req.user.holdings) });
  })
);

// Manual rate override / correction — always available regardless of autoSync,
// since a manual edit is a perfectly normal thing to want to do.
router.patch(
  '/:id/rate',
  asyncHandler(async (req, res) => {
    const holding = req.user.holdings.id(req.params.id);
    if (!holding) return res.status(404).json({ error: 'Holding not found' });
    holding.currentRate = Number(req.body.currentRate) || 0;
    holding.updatedAt = new Date().toISOString().slice(0, 10);
    await req.user.save();
    res.json({ holdings: serializeList(req.user.holdings) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const holding = req.user.holdings.id(req.params.id);
    if (!holding) return res.status(404).json({ error: 'Holding not found' });
    const { name, symbol, autoSync } = req.body || {};
    if (name) holding.name = String(name).trim();
    if (symbol !== undefined) holding.symbol = String(symbol).trim();
    if (autoSync !== undefined) holding.autoSync = !!autoSync;
    await req.user.save();
    res.json({ holdings: serializeList(req.user.holdings) });
  })
);

// Trigger a sync for just this one holding right now, instead of waiting for
// the once-a-day scheduled job.
router.post(
  '/:id/sync-now',
  asyncHandler(async (req, res) => {
    const holding = req.user.holdings.id(req.params.id);
    if (!holding) return res.status(404).json({ error: 'Holding not found' });
    if (holding.assetType === 'Stock' && !holding.symbol) {
      return res.status(400).json({ error: 'Add a symbol first (paste what Google shows, e.g. "NSE:GOLDBEES" or "DATAPATTNS").' });
    }
    if (holding.assetType === 'Gold') {
      return res.status(400).json({ error: 'Gold has no auto-sync source — update the rate manually.' });
    }
    await syncHolding(holding);
    await req.user.save();
    res.json({ holdings: serializeList(req.user.holdings) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.holdings.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ holdings: serializeList(req.user.holdings) });
  })
);

module.exports = router;

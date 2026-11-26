const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { findHolding, sameName } = require('../utils/holdingsLedger');
const { round2 } = require('../utils/money');
const { makeSensitiveLimiter } = require('../middleware/security');
const { syncHolding } = require('../services/priceSyncService');
const V = require('../utils/validate');

const router = express.Router();
const ASSET_TYPES = ['Stock', 'Mutual Fund', 'Gold'];
const reply = (u) => ({ holdings: serializeList(u.holdings), transactions: serializeList(u.transactions) });
const syncLimiter = makeSensitiveLimiter(30, 15 * 60 * 1000);

router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  const name = V.str(b.name, { field: 'name', required: true, max: 120 });
  const assetType = V.oneOf(b.assetType, ASSET_TYPES, { field: 'assetType', required: true });
  const existing = findHolding(req.user, name, assetType);
  if (existing) {
    return res.status(409).json({ error: `You already have a holding named "${existing.name}". Log a transaction to add to it, or edit the existing one.` });
  }
  const qty = V.num(b.qty, { field: 'qty', min: 0, max: 1e12 }) ?? 0;
  const avgRate = V.num(b.avgRate, { field: 'avgRate', min: 0, max: 1e9 }) ?? 0;
  const currentRate = V.num(b.currentRate, { field: 'currentRate', min: 0, max: 1e9 }) ?? avgRate;
  const symbol = V.str(b.symbol, { field: 'symbol', max: 30 }).toUpperCase();
  const today = todayStr();

  req.user.holdings.push({
    name, symbol, assetType, qty, avgRate, currentRate,
    autoSync: V.bool(b.autoSync, { field: 'autoSync', fallback: true }),
    lastSyncStatus: 'pending', updatedAt: today,
  });
  // Opening balance goes into the ledger too, so holding and transactions agree
  // (otherwise a later edit/delete of a transaction could not be reconciled).
  if (qty > 0) {
    req.user.transactions.push({
      date: today, type: 'Buy', assetType, name, symbol, qty,
      price: avgRate, amount: round2(qty * avgRate), notes: 'Opening balance',
    });
  }
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

// Manual rate override - strict: blank / non-numeric input is rejected rather
// than silently setting the rate to 0.
router.patch('/:id/rate', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const holding = req.user.holdings.id(req.params.id);
  if (!holding) return res.status(404).json({ error: 'Holding not found' });
  holding.currentRate = V.num(V.body(req).currentRate, { field: 'currentRate', min: 0, max: 1e9, required: true });
  holding.updatedAt = todayStr();
  await req.user.save();
  res.json(reply(req.user));
}));

router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const holding = req.user.holdings.id(req.params.id);
  if (!holding) return res.status(404).json({ error: 'Holding not found' });
  const b = V.body(req);
  if (b.name !== undefined) {
    const name = V.str(b.name, { field: 'name', required: true, max: 120 });
    const clash = req.user.holdings.find((h) => String(h._id) !== String(holding._id) && h.assetType === holding.assetType && sameName(h.name, name));
    if (clash) return res.status(409).json({ error: `Another holding is already named "${clash.name}"` });
    // Keep the transaction history linked to this holding after a rename.
    req.user.transactions.forEach((t) => { if (t.assetType === holding.assetType && sameName(t.name, holding.name)) t.name = name; });
    holding.name = name;
  }
  if (b.symbol !== undefined) holding.symbol = V.str(b.symbol, { field: 'symbol', max: 30 }).toUpperCase();
  if (b.autoSync !== undefined) holding.autoSync = V.bool(b.autoSync, { field: 'autoSync' });
  await req.user.save();
  res.json(reply(req.user));
}));

router.post('/:id/sync-now', syncLimiter, mutating(async (req, res) => {
  V.objectId(req.params.id);
  const holding = req.user.holdings.id(req.params.id);
  if (!holding) return res.status(404).json({ error: 'Holding not found' });
  if (holding.assetType === 'Stock' && !holding.symbol) {
    return res.status(400).json({ error: 'Add a symbol first (e.g. "NSE:GOLDBEES" or "DATAPATTNS").' });
  }
  if (holding.assetType === 'Gold') return res.status(400).json({ error: 'Gold has no auto-sync source - update the rate manually.' });
  await syncHolding(holding);
  await req.user.save();
  res.json(reply(req.user));
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  if (!req.user.holdings.id(req.params.id)) return res.status(404).json({ error: 'Holding not found' });
  req.user.holdings.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

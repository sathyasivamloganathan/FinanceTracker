const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { applyTx, reverseTx } = require('../utils/holdingsLedger');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const ASSET_TYPES = ['Stock', 'Mutual Fund', 'Gold'];

const reply = (u) => ({ transactions: serializeList(u.transactions), holdings: serializeList(u.holdings) });

function parse(b, base = {}) {
  const t = { ...base };
  const has = (k) => b[k] !== undefined;
  if (has('date') || !t.date) t.date = V.date(b.date, { field: 'date' }) || todayStr();
  if (has('type') || !t.type) t.type = V.oneOf(b.type, ['Buy', 'Sell'], { field: 'type', required: true });
  if (has('assetType') || !t.assetType) t.assetType = V.oneOf(b.assetType, ASSET_TYPES, { field: 'assetType', required: true });
  if (has('name') || !t.name) t.name = V.str(b.name, { field: 'name', required: true, max: 120 });
  if (has('symbol')) t.symbol = V.str(b.symbol, { field: 'symbol', max: 30 }).toUpperCase();
  else if (t.symbol === undefined) t.symbol = '';
  if (has('qty') || !t.qty) t.qty = V.num(b.qty, { field: 'qty', min: 0.000001, max: 1e12, required: true });
  if (has('price') || !t.price) t.price = V.num(b.price, { field: 'price', min: 0.000001, max: 1e9, required: true });
  if (has('notes')) t.notes = V.str(b.notes, { field: 'notes', max: 300 });
  else if (t.notes === undefined) t.notes = '';
  const amountGiven = V.num(b.amount, { field: 'amount', min: 0, max: 1e12 });
  if (amountGiven !== undefined && amountGiven > 0) t.amount = round2(amountGiven);
  else if (has('qty') || has('price') || t.amount === undefined) t.amount = round2(t.qty * t.price);
  return t;
}

router.post('/', mutating(async (req, res) => {
  const tx = parse(V.body(req));
  applyTx(req.user, tx, { today: todayStr() }); // throws 409 on an invalid sell
  req.user.transactions.push(tx);
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

// Edit = reverse the old transaction's effect on the holding, apply the new one.
router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const tx = req.user.transactions.id(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  const old = tx.toObject();
  const next = parse(V.body(req), { ...old });
  const today = todayStr();
  reverseTx(req.user, old, { today });
  applyTx(req.user, next, { today });
  for (const k of ['date', 'type', 'assetType', 'name', 'symbol', 'qty', 'price', 'amount', 'notes']) tx[k] = next[k];
  await req.user.save();
  res.json(reply(req.user));
}));

// Delete = reverse its effect on the holding.
router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const tx = req.user.transactions.id(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  reverseTx(req.user, tx.toObject(), { today: todayStr() });
  req.user.transactions.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

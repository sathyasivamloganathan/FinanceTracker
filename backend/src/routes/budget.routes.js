const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { mutating } = require('../utils/asyncHandler');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const MAX_CATEGORIES = 100;
const MAX_MONTHS = 240;

router.get('/:monthKey', asyncHandler(async (req, res) => {
  const mk = V.monthKey(req.params.monthKey, 'monthKey');
  const own = Object.prototype.hasOwnProperty.call(req.user.budgets || {}, mk);
  res.json({ monthKey: mk, budget: own ? req.user.budgets[mk] : {} });
}));

router.put('/:monthKey', mutating(async (req, res) => {
  const mk = V.monthKey(req.params.monthKey, 'monthKey');
  const { budget } = V.body(req);
  if (!V.isPlainObject(budget)) throw V.bad('budget must be an object of category → amount');
  const entries = Object.entries(budget);
  if (entries.length > MAX_CATEGORIES) throw V.bad(`At most ${MAX_CATEGORIES} budget categories`);

  const cleaned = {};
  for (const [cat, amt] of entries) {
    const key = V.safeKey(cat);
    const n = V.num(amt, { field: `amount for ${cat}`, min: 0, max: 1e10, required: true });
    if (n > 0) cleaned[key] = round2(n);
  }
  const budgets = { ...(req.user.budgets || {}) };
  if (!(mk in budgets) && Object.keys(budgets).length >= MAX_MONTHS) throw V.bad('Too many budget months stored');
  budgets[mk] = cleaned;
  req.user.budgets = budgets;
  req.user.markModified('budgets');
  await req.user.save();
  res.json({ monthKey: mk, budget: cleaned });
}));

module.exports = router;

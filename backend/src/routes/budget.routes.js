const express = require('express');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/:monthKey', asyncHandler(async (req, res) => {
  const mk = req.params.monthKey;
  if (!/^\d{4}-\d{2}$/.test(mk)) return res.status(400).json({ error: 'monthKey must be YYYY-MM' });
  const budget = (req.user.budgets || {})[mk];
  res.json({ monthKey: mk, budget: budget || {} });
}));

router.put('/:monthKey', asyncHandler(async (req, res) => {
  const mk = req.params.monthKey;
  if (!/^\d{4}-\d{2}$/.test(mk)) return res.status(400).json({ error: 'monthKey must be YYYY-MM' });

  const { budget } = req.body || {};
  if (!budget || typeof budget !== 'object' || Array.isArray(budget))
    return res.status(400).json({ error: 'budget must be an object of category → amount' });

  for (const [cat, amt] of Object.entries(budget)) {
    if (typeof cat !== 'string' || cat.length > 60) return res.status(400).json({ error: `Invalid category: ${cat}` });
    if (isNaN(Number(amt)) || Number(amt) < 0) return res.status(400).json({ error: `Invalid amount for ${cat}` });
  }

  const cleaned = {};
  for (const [cat, amt] of Object.entries(budget)) {
    if (Number(amt) > 0) cleaned[cat] = Number(amt);
  }

  // Use set() with a rebuilt object to ensure Mongoose detects the change
  if (!req.user.budgets) req.user.budgets = {};
  req.user.budgets = { ...req.user.budgets, [mk]: cleaned };
  req.user.markModified('budgets');
  await req.user.save();
  res.json({ monthKey: mk, budget: cleaned });
}));

module.exports = router;

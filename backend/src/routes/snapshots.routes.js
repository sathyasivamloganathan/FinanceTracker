const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { holdingInvestedValue, holdingCurrentValue } = require('../utils/financeMath');

const router = express.Router();

function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

function computeNetWorth(user) {
  const breakdown = {};

  // Market holdings (current value)
  user.holdings.forEach((h) => {
    const cat = { Stock: 'Stocks', 'Mutual Fund': 'Mutual Funds', Gold: 'Gold' }[h.assetType] || h.assetType;
    breakdown[cat] = (breakdown[cat] || 0) + holdingCurrentValue(h);
  });

  // Other assets (cash, real estate, etc.)
  user.otherAssets.forEach((a) => {
    breakdown[a.category] = (breakdown[a.category] || 0) + (Number(a.amount) || 0);
  });

  // Fixed Deposits — principal (active only)
  const fdTotal = (user.fds || [])
    .filter(fd => fd.status === 'active')
    .reduce((s, fd) => s + (Number(fd.principal) || 0), 0);
  if (fdTotal > 0) breakdown['Fixed Deposits'] = (breakdown['Fixed Deposits'] || 0) + fdTotal;

  // Bank accounts
  const bankTotal = (user.bankAccounts || [])
    .reduce((s, a) => s + (Number(a.balance) || 0), 0);
  if (bankTotal > 0) breakdown['Bank Accounts'] = (breakdown['Bank Accounts'] || 0) + bankTotal;

  const grossAssets = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const totalLiabilities = user.liabilities.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const invested = user.holdings.reduce((s, h) => s + holdingInvestedValue(h), 0)
    + user.otherAssets.reduce((s, a) => s + (Number(a.amount) || 0), 0)
    + fdTotal + bankTotal;

  return { netWorth: grossAssets - totalLiabilities, invested, breakdown };
}

// Auto snapshot of current state
router.post('/', asyncHandler(async (req, res) => {
  const { netWorth, invested, breakdown } = computeNetWorth(req.user);
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  req.user.netWorthSnapshots.push({ date, netWorth, invested, breakdown });
  await req.user.save();
  res.status(201).json({ netWorthSnapshots: serializeList(req.user.netWorthSnapshots) });
}));

// Manual past entry
router.post('/manual', asyncHandler(async (req, res) => {
  const { date, netWorth, notes } = req.body || {};
  if (!isDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const nw = Number(netWorth);
  if (isNaN(nw)) return res.status(400).json({ error: 'netWorth must be a number' });
  req.user.netWorthSnapshots.push({ date, netWorth: nw, invested: nw, breakdown: { Manual: nw }, notes: notes || '' });
  req.user.netWorthSnapshots.sort((a, b) => a.date.localeCompare(b.date));
  await req.user.save();
  res.status(201).json({ netWorthSnapshots: serializeList(req.user.netWorthSnapshots) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  req.user.netWorthSnapshots.pull({ _id: req.params.id });
  await req.user.save();
  res.json({ netWorthSnapshots: serializeList(req.user.netWorthSnapshots) });
}));

module.exports = router;

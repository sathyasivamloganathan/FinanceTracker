const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { holdingInvestedValue, holdingCurrentValue } = require('../utils/financeMath');

const router = express.Router();

function computeNetWorth(user) {
  const breakdown = {};
  user.holdings.forEach((h) => {
    const cat = { Stock: 'Stocks', 'Mutual Fund': 'Mutual Funds', Gold: 'Gold' }[h.assetType] || h.assetType;
    breakdown[cat] = (breakdown[cat] || 0) + holdingCurrentValue(h);
  });
  user.otherAssets.forEach((a) => {
    breakdown[a.category] = (breakdown[a.category] || 0) + (Number(a.amount) || 0);
  });
  const grossAssets = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const totalLiabilities = user.liabilities.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const invested = user.holdings.reduce((s, h) => s + holdingInvestedValue(h), 0) + user.otherAssets.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  return { netWorth: grossAssets - totalLiabilities, invested, breakdown };
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { netWorth, invested, breakdown } = computeNetWorth(req.user);
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    req.user.netWorthSnapshots.push({ date, netWorth, invested, breakdown });
    await req.user.save();
    res.status(201).json({ netWorthSnapshots: serializeList(req.user.netWorthSnapshots) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.netWorthSnapshots.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ netWorthSnapshots: serializeList(req.user.netWorthSnapshots) });
  })
);

module.exports = router;

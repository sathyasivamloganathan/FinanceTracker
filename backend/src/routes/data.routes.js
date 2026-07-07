const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const u = req.user;
    res.json({
      otherAssets: serializeList(u.otherAssets),
      holdings: serializeList(u.holdings),
      transactions: serializeList(u.transactions),
      expenses: serializeList(u.expenses),
      insurance: serializeList(u.insurance),
      liabilities: serializeList(u.liabilities),
      goals: serializeList(u.goals),
      netWorthSnapshots: serializeList(u.netWorthSnapshots),
      targets: Object.fromEntries(u.targets),
      privacyModeDefault: u.privacyModeDefault,
      financialProfile: u.financialProfile,
      profile: { name: u.name, email: u.email },
    });
  })
);

router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const { privacyModeDefault } = req.body || {};
    if (typeof privacyModeDefault === 'boolean') {
      req.user.privacyModeDefault = privacyModeDefault;
    }
    await req.user.save();
    res.json({ privacyModeDefault: req.user.privacyModeDefault });
  })
);

module.exports = router;

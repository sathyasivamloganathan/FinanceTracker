const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const u = req.user;
  res.json({
    otherAssets: serializeList(u.otherAssets),
    holdings: serializeList(u.holdings),
    transactions: serializeList(u.transactions),
    expenses: serializeList(u.expenses),
    bankAccounts: serializeList(u.bankAccounts),
    fds: serializeList(u.fds),
    insurance: serializeList(u.insurance),
    liabilities: serializeList(u.liabilities),
    goals: serializeList(u.goals),
    netWorthSnapshots: serializeList(u.netWorthSnapshots),
    recurring: serializeList(u.recurring || []),
    budgets: u.budgets instanceof Map ? Object.fromEntries(u.budgets) : (u.budgets || {}),
    targets: Object.fromEntries(u.targets),
    privacyModeDefault: u.privacyModeDefault,
    darkModeDefault: u.darkModeDefault,
    financialProfile: u.financialProfile,
    profile: { name: u.name, email: u.email },
  });
}));

router.patch('/settings', asyncHandler(async (req, res) => {
  const { privacyModeDefault, darkModeDefault } = req.body || {};
  if (typeof privacyModeDefault === 'boolean') req.user.privacyModeDefault = privacyModeDefault;
  if (typeof darkModeDefault === 'boolean') req.user.darkModeDefault = darkModeDefault;
  await req.user.save();
  res.json({ privacyModeDefault: req.user.privacyModeDefault, darkModeDefault: req.user.darkModeDefault });
}));

module.exports = router;

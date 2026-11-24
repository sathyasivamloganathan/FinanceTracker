const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const V = require('../utils/validate');

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
    recurring: serializeList(u.recurring),
    budgets: u.budgets || {},
    targets: Object.fromEntries(u.targets || []),
    privacyModeDefault: u.privacyModeDefault,
    darkModeDefault: u.darkModeDefault,
    financialProfile: u.financialProfile,
    profile: { name: u.name, email: u.email },
  });
}));

router.patch('/settings', mutating(async (req, res) => {
  const b = V.body(req);
  const p = V.bool(b.privacyModeDefault, { field: 'privacyModeDefault' });
  const d = V.bool(b.darkModeDefault, { field: 'darkModeDefault' });
  if (p !== undefined) req.user.privacyModeDefault = p;
  if (d !== undefined) req.user.darkModeDefault = d;
  await req.user.save();
  res.json({ privacyModeDefault: req.user.privacyModeDefault, darkModeDefault: req.user.darkModeDefault });
}));

module.exports = router;

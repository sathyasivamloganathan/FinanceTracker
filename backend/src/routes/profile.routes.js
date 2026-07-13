const express = require('express');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const { dateOfBirth, monthlyIncome, name } = req.body || {};
    if (dateOfBirth !== undefined) req.user.financialProfile.dateOfBirth = dateOfBirth === '' ? null : dateOfBirth;
    if (monthlyIncome !== undefined) req.user.financialProfile.monthlyIncome = monthlyIncome === '' ? null : Number(monthlyIncome);
    if (name !== undefined && String(name).trim()) req.user.name = String(name).trim();
    await req.user.save();
    res.json({ financialProfile: req.user.financialProfile, name: req.user.name });
  })
);

module.exports = router;

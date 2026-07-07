const express = require('express');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const { age, monthlyIncome } = req.body || {};
    if (age !== undefined) req.user.financialProfile.age = age === '' ? null : Number(age);
    if (monthlyIncome !== undefined) req.user.financialProfile.monthlyIncome = monthlyIncome === '' ? null : Number(monthlyIncome);
    await req.user.save();
    res.json({ financialProfile: req.user.financialProfile });
  })
);

module.exports = router;

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { date, category, description, amount } = req.body || {};
    const amountNum = Number(amount);
    if (!(amountNum > 0)) return res.status(400).json({ error: 'amount must be a positive number' });
    req.user.expenses.push({
      date: date || new Date().toISOString().slice(0, 10),
      category: category || 'Other',
      description: description ? String(description).trim() : '',
      amount: amountNum,
    });
    await req.user.save();
    res.status(201).json({ expenses: serializeList(req.user.expenses) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const expense = req.user.expenses.id(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    const { date, category, description, amount } = req.body || {};
    if (date) expense.date = date;
    if (category) expense.category = category;
    if (description !== undefined) expense.description = String(description).trim();
    if (amount !== undefined) expense.amount = Number(amount) || expense.amount;
    await req.user.save();
    res.json({ expenses: serializeList(req.user.expenses) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.expenses.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ expenses: serializeList(req.user.expenses) });
  })
);

module.exports = router;

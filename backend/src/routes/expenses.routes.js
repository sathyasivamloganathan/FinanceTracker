const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

const VALID_EXPENSE_TYPES = ['expense', 'transfer', 'atm_withdrawal', 'income'];
const MAX_DESC = 200;
const MAX_CAT = 60;

function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

router.post('/', asyncHandler(async (req, res) => {
  const { date, category, description, amount, accountId, expenseType, transferToAccountId } = req.body || {};

  const amountNum = Number(amount);
  if (!(amountNum > 0)) return res.status(400).json({ error: 'amount must be a positive number' });
  if (amountNum > 1e9) return res.status(400).json({ error: 'amount exceeds maximum allowed' });
  if (date && !isDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  if (expenseType && !VALID_EXPENSE_TYPES.includes(expenseType))
    return res.status(400).json({ error: 'Invalid expenseType' });

  const txDate = (date && isDate(date)) ? date : new Date().toISOString().slice(0, 10);

  req.user.expenses.push({
    date: txDate,
    category: category ? String(category).trim().slice(0, MAX_CAT) : 'Other',
    description: description ? String(description).trim().slice(0, MAX_DESC) : '',
    amount: amountNum,
    accountId: accountId || '',
    expenseType: VALID_EXPENSE_TYPES.includes(expenseType) ? expenseType : 'expense',
    transferToAccountId: transferToAccountId || '',
  });

  // Auto-deduct from linked bank account for regular expenses
  if (accountId && (expenseType === 'expense' || !expenseType)) {
    const acct = req.user.bankAccounts.id(accountId);
    if (acct) { acct.balance -= amountNum; acct.updatedAt = txDate; }
  }

  await req.user.save();
  res.status(201).json({
    expenses: serializeList(req.user.expenses),
    bankAccounts: serializeList(req.user.bankAccounts),
  });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const expense = req.user.expenses.id(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const { date, category, description, amount, accountId } = req.body || {};
  if (date !== undefined) {
    if (!isDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    expense.date = date;
  }
  if (category !== undefined) expense.category = String(category).trim().slice(0, MAX_CAT);
  if (description !== undefined) expense.description = String(description).trim().slice(0, MAX_DESC);
  if (amount !== undefined) {
    const a = Number(amount);
    if (!(a > 0) || a > 1e9) return res.status(400).json({ error: 'amount must be a positive number ≤ 1 billion' });
    expense.amount = a;
  }
  if (accountId !== undefined) expense.accountId = accountId;

  await req.user.save();
  res.json({ expenses: serializeList(req.user.expenses) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const expense = req.user.expenses.id(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  req.user.expenses.pull({ _id: req.params.id });
  await req.user.save();
  res.json({ expenses: serializeList(req.user.expenses) });
}));

module.exports = router;

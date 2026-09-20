const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

const VALID_TYPES = ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Other'];
const MAX_NAME = 120;
const MAX_NOTES = 300;

function validateName(name) {
  return name && typeof name === 'string' && name.trim().length > 0 && name.trim().length <= MAX_NAME;
}

router.get('/', asyncHandler(async (req, res) => {
  res.json({ bankAccounts: serializeList(req.user.bankAccounts) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, type, balance, color, notes } = req.body || {};
  if (!validateName(name)) return res.status(400).json({ error: `name is required (max ${MAX_NAME} chars)` });
  if (type && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid account type' });

  const balanceNum = Number(balance);
  if (isNaN(balanceNum)) return res.status(400).json({ error: 'balance must be a number' });

  // Prevent duplicate account names per user
  const dupe = req.user.bankAccounts.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
  if (dupe) return res.status(409).json({ error: `An account named "${dupe.name}" already exists` });

  req.user.bankAccounts.push({
    name: String(name).trim().slice(0, MAX_NAME),
    type: VALID_TYPES.includes(type) ? type : 'Savings',
    balance: balanceNum,
    color: color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#2563EB',
    notes: notes ? String(notes).trim().slice(0, MAX_NOTES) : '',
    updatedAt: new Date().toISOString().slice(0, 10),
  });
  await req.user.save();
  res.status(201).json({ bankAccounts: serializeList(req.user.bankAccounts) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const account = req.user.bankAccounts.id(req.params.id);
  if (!account) return res.status(404).json({ error: 'Bank account not found' });

  const { name, type, balance, color, notes } = req.body || {};
  if (name !== undefined) {
    if (!validateName(name)) return res.status(400).json({ error: `name is required (max ${MAX_NAME} chars)` });
    account.name = String(name).trim().slice(0, MAX_NAME);
  }
  if (type !== undefined) {
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid account type' });
    account.type = type;
  }
  if (balance !== undefined) {
    const b = Number(balance);
    if (isNaN(b)) return res.status(400).json({ error: 'balance must be a number' });
    account.balance = b;
  }
  if (color !== undefined && /^#[0-9A-Fa-f]{6}$/.test(color)) account.color = color;
  if (notes !== undefined) account.notes = String(notes).trim().slice(0, MAX_NOTES);
  account.updatedAt = new Date().toISOString().slice(0, 10);
  await req.user.save();
  res.json({ bankAccounts: serializeList(req.user.bankAccounts) });
}));

router.post('/transfer', asyncHandler(async (req, res) => {
  const { fromId, toId, amount, date, notes } = req.body || {};
  const amountNum = Number(amount);
  if (!(amountNum > 0)) return res.status(400).json({ error: 'amount must be a positive number' });
  if (typeof fromId !== 'string') return res.status(400).json({ error: 'fromId is required' });

  const from = req.user.bankAccounts.id(fromId);
  if (!from) return res.status(404).json({ error: 'Source account not found' });

  const to = toId ? req.user.bankAccounts.id(toId) : null;
  if (toId && !to) return res.status(404).json({ error: 'Destination account not found' });
  if (to && String(from._id) === String(to._id)) return res.status(400).json({ error: 'Source and destination must differ' });

  const txDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  from.balance -= amountNum;
  from.updatedAt = txDate;
  if (to) { to.balance += amountNum; to.updatedAt = txDate; }

  req.user.expenses.push({
    date: txDate,
    category: to ? 'Transfer' : 'ATM Withdrawal',
    description: notes ? String(notes).trim().slice(0, 200) : (to ? `Transfer → ${to.name}` : 'ATM Withdrawal'),
    amount: amountNum,
    accountId: fromId,
    expenseType: to ? 'transfer' : 'atm_withdrawal',
    transferToAccountId: to ? String(to._id) : '',
  });

  await req.user.save();
  res.json({ bankAccounts: serializeList(req.user.bankAccounts), expenses: serializeList(req.user.expenses) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const account = req.user.bankAccounts.id(req.params.id);
  if (!account) return res.status(404).json({ error: 'Bank account not found' });
  req.user.bankAccounts.pull({ _id: req.params.id });
  await req.user.save();
  res.json({ bankAccounts: serializeList(req.user.bankAccounts) });
}));

module.exports = router;

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { applyEntry, assertAccountsExist } = require('../utils/ledger');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const TYPES = ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Other'];
const dupe = (user, name, exceptId) =>
  user.bankAccounts.find((a) => String(a._id) !== String(exceptId) && a.name.toLowerCase() === name.toLowerCase());

router.get('/', asyncHandler(async (req, res) => {
  res.json({ bankAccounts: serializeList(req.user.bankAccounts) });
}));

router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  const name = V.str(b.name, { field: 'name', required: true, max: 120 });
  const d = dupe(req.user, name);
  if (d) return res.status(409).json({ error: `An account named "${d.name}" already exists` });
  const color = b.color === undefined || b.color === '' ? '#2563EB' : V.str(b.color, { field: 'color', max: 9 });
  if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) throw V.bad('color must be a hex colour like #2563EB');
  req.user.bankAccounts.push({
    name,
    type: V.oneOf(b.type, TYPES, { field: 'type', fallback: 'Savings' }),
    balance: round2(V.num(b.balance, { field: 'balance', min: -1e12, max: 1e12 }) ?? 0),
    color,
    notes: V.str(b.notes, { field: 'notes', max: 200 }),
    updatedAt: todayStr(),
  });
  await req.user.save();
  res.status(201).json({ bankAccounts: serializeList(req.user.bankAccounts) });
}));

router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const acct = req.user.bankAccounts.id(req.params.id);
  if (!acct) return res.status(404).json({ error: 'Bank account not found' });
  const b = V.body(req);
  if (b.name !== undefined) {
    const name = V.str(b.name, { field: 'name', required: true, max: 120 });
    const d = dupe(req.user, name, acct._id);
    if (d) return res.status(409).json({ error: `An account named "${d.name}" already exists` });
    acct.name = name;
  }
  if (b.type !== undefined) acct.type = V.oneOf(b.type, TYPES, { field: 'type', required: true });
  if (b.balance !== undefined) acct.balance = round2(V.num(b.balance, { field: 'balance', required: true, min: -1e12, max: 1e12 }));
  if (b.color !== undefined) {
    const c = V.str(b.color, { field: 'color', max: 9 });
    if (!/^#[0-9a-fA-F]{3,8}$/.test(c)) throw V.bad('color must be a hex colour like #2563EB');
    acct.color = c;
  }
  if (b.notes !== undefined) acct.notes = V.str(b.notes, { field: 'notes', max: 200 });
  acct.updatedAt = todayStr();
  await req.user.save();
  res.json({ bankAccounts: serializeList(req.user.bankAccounts) });
}));

// Transfer between two accounts, or an ATM withdrawal when toId is omitted.
// Recorded through the same ledger as /api/expenses so edits/deletes of the
// resulting entry reverse the balance change correctly.
router.post('/transfer', mutating(async (req, res) => {
  const b = V.body(req);
  const fromId = V.str(b.fromId, { field: 'fromId', required: true, max: 40 });
  const toId = V.str(b.toId, { field: 'toId', max: 40 });
  const amount = V.num(b.amount, { field: 'amount', min: 0.01, max: 1e9, required: true });
  const date = V.date(b.date, { field: 'date' }) || todayStr();
  const notes = V.str(b.notes, { field: 'notes', max: 200 });

  const from = req.user.bankAccounts.id(fromId);
  if (!from) return res.status(404).json({ error: 'Source account not found' });
  const to = toId ? req.user.bankAccounts.id(toId) : null;
  if (toId && !to) return res.status(404).json({ error: 'Destination account not found' });

  const entry = {
    date,
    category: to ? 'Transfer' : 'ATM Withdrawal',
    description: notes || (to ? `Transfer → ${to.name}` : 'ATM Withdrawal'),
    amount,
    accountId: String(from._id),
    expenseType: to ? 'transfer' : 'atm_withdrawal',
    transferToAccountId: to ? String(to._id) : '',
  };
  assertAccountsExist(req.user, entry);
  req.user.expenses.push(entry);
  applyEntry(req.user, entry);
  await req.user.save();
  res.status(201).json({ bankAccounts: serializeList(req.user.bankAccounts), expenses: serializeList(req.user.expenses) });
}));

// Deleting an account clears every reference to it so nothing dangles.
router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const id = req.params.id;
  if (!req.user.bankAccounts.id(id)) return res.status(404).json({ error: 'Bank account not found' });
  req.user.expenses.forEach((e) => {
    if (e.accountId === id) e.accountId = '';
    if (e.transferToAccountId === id) e.transferToAccountId = '';
  });
  req.user.fds.forEach((f) => { if (f.accountId === id) f.accountId = ''; if (f.creditToAccountId === id) f.creditToAccountId = ''; });
  req.user.recurring.forEach((r) => { if (r.accountId === id) r.accountId = ''; });
  req.user.bankAccounts.pull({ _id: id });
  await req.user.save();
  res.json({
    bankAccounts: serializeList(req.user.bankAccounts),
    expenses: serializeList(req.user.expenses),
    fds: serializeList(req.user.fds),
    recurring: serializeList(req.user.recurring),
  });
}));

module.exports = router;

const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { applyEntry, reverseEntry, assertAccountsExist } = require('../utils/ledger');
const V = require('../utils/validate');

const router = express.Router();
const TYPES = ['expense', 'transfer', 'atm_withdrawal', 'income'];
const MAX_AMOUNT = 1e9;

const reply = (u) => ({ expenses: serializeList(u.expenses), bankAccounts: serializeList(u.bankAccounts) });

function parseFields(b, { partial }) {
  const out = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has('date')) out.date = V.date(b.date, { field: 'date' }) || todayStr();
  if (!partial || has('category')) out.category = V.str(b.category, { field: 'category', max: 60 }) || 'Other';
  if (!partial || has('description')) out.description = V.str(b.description, { field: 'description', max: 200 });
  if (!partial || has('amount')) out.amount = V.num(b.amount, { field: 'amount', min: 0.01, max: MAX_AMOUNT, required: true });
  if (!partial || has('accountId')) out.accountId = V.str(b.accountId, { field: 'accountId', max: 40 });
  if (!partial || has('expenseType')) out.expenseType = V.oneOf(b.expenseType, TYPES, { field: 'expenseType', fallback: 'expense' });
  if (!partial || has('transferToAccountId')) out.transferToAccountId = V.str(b.transferToAccountId, { field: 'transferToAccountId', max: 40 });
  if (!partial || has('notes')) out.notes = V.str(b.notes, { field: 'notes', max: 300 });
  return out;
}

function checkTransfer(e) {
  if (e.expenseType === 'transfer' && !(e.accountId && e.transferToAccountId)) {
    throw V.bad('A transfer needs both a source and a destination account');
  }
  if (e.expenseType !== 'transfer') e.transferToAccountId = '';
}

router.post('/', mutating(async (req, res) => {
  const e = parseFields(V.body(req), { partial: false });
  checkTransfer(e);
  assertAccountsExist(req.user, e);
  req.user.expenses.push(e);
  applyEntry(req.user, e);
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const expense = req.user.expenses.id(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const patch = parseFields(V.body(req), { partial: true });
  const before = expense.toObject();
  const next = { ...before, ...patch };
  checkTransfer(next);
  assertAccountsExist(req.user, next);

  reverseEntry(req.user, before);          // undo the old balance effect…
  for (const k of Object.keys(patch)) expense[k] = next[k];
  if (next.transferToAccountId !== undefined) expense.transferToAccountId = next.transferToAccountId;
  applyEntry(req.user, next);              // …and apply the new one
  await req.user.save();
  res.json(reply(req.user));
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const expense = req.user.expenses.id(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  reverseEntry(req.user, expense.toObject()); // deleting refunds / un-credits the account
  req.user.expenses.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

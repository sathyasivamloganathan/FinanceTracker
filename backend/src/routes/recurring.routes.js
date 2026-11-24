const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { generateRecurringForUser } = require('../utils/recurring');
const V = require('../utils/validate');

const router = express.Router();
const FREQ = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];
const TYPES = ['expense', 'income'];

function checkAccount(user, id) {
  if (id && !user.bankAccounts.id(id)) throw V.bad('Selected account not found');
}

router.get('/', asyncHandler(async (req, res) => res.json({ recurring: serializeList(req.user.recurring) })));

router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  const startDate = V.date(b.startDate, { field: 'startDate', required: true });
  const endDate = V.date(b.endDate, { field: 'endDate' });
  if (endDate && endDate < startDate) throw V.bad('endDate cannot be before startDate');
  const accountId = V.str(b.accountId, { field: 'accountId', max: 40 });
  checkAccount(req.user, accountId);
  req.user.recurring.push({
    name: V.str(b.name, { field: 'name', required: true, max: 120 }),
    amount: V.num(b.amount, { field: 'amount', min: 0.01, max: 1e9, required: true }),
    category: V.str(b.category, { field: 'category', max: 60 }) || 'Other',
    accountId,
    frequency: V.oneOf(b.frequency, FREQ, { field: 'frequency', required: true }),
    type: V.oneOf(b.type, TYPES, { field: 'type', fallback: 'expense' }),
    startDate, endDate, active: true, lastGeneratedDate: '',
    notes: V.str(b.notes, { field: 'notes', max: 200 }),
  });
  await req.user.save();
  res.status(201).json({ recurring: serializeList(req.user.recurring) });
}));

router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const item = req.user.recurring.id(req.params.id);
  if (!item) return res.status(404).json({ error: 'Recurring template not found' });
  const b = V.body(req);
  if (b.name !== undefined) item.name = V.str(b.name, { field: 'name', required: true, max: 120 });
  if (b.amount !== undefined) item.amount = V.num(b.amount, { field: 'amount', min: 0.01, max: 1e9, required: true });
  if (b.category !== undefined) item.category = V.str(b.category, { field: 'category', max: 60 }) || 'Other';
  if (b.accountId !== undefined) { const a = V.str(b.accountId, { field: 'accountId', max: 40 }); checkAccount(req.user, a); item.accountId = a; }
  if (b.frequency !== undefined) item.frequency = V.oneOf(b.frequency, FREQ, { field: 'frequency', required: true });
  if (b.type !== undefined) item.type = V.oneOf(b.type, TYPES, { field: 'type', required: true });
  if (b.startDate !== undefined) item.startDate = V.date(b.startDate, { field: 'startDate', required: true });
  if (b.endDate !== undefined) item.endDate = V.date(b.endDate, { field: 'endDate' });
  if (b.active !== undefined) item.active = V.bool(b.active, { field: 'active' });
  if (b.notes !== undefined) item.notes = V.str(b.notes, { field: 'notes', max: 200 });
  if (item.endDate && item.endDate < item.startDate) throw V.bad('endDate cannot be before startDate');
  // Schedule edits apply to FUTURE occurrences; entries already created stay as they are.
  await req.user.save();
  res.json({ recurring: serializeList(req.user.recurring) });
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  if (!req.user.recurring.id(req.params.id)) return res.status(404).json({ error: 'Recurring template not found' });
  req.user.recurring.pull({ _id: req.params.id });
  await req.user.save();
  res.json({ recurring: serializeList(req.user.recurring) });
}));

// Create every entry that is due (includes the start date itself) and apply
// it to the linked bank account — same code path as the nightly job.
router.post('/generate', mutating(async (req, res) => {
  const generated = generateRecurringForUser(req.user, todayStr());
  if (req.user.isModified()) await req.user.save();
  res.json({
    generated,
    expenses: serializeList(req.user.expenses),
    bankAccounts: serializeList(req.user.bankAccounts),
    recurring: serializeList(req.user.recurring),
  });
}));

module.exports = router;

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

const VALID_FREQ = ['daily','weekly','fortnightly','monthly','quarterly','yearly'];
const VALID_TYPES = ['expense','income'];

function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

function nextDate(d, freq) {
  const n = new Date(d);
  if (freq === 'daily')        n.setDate(n.getDate() + 1);
  else if (freq === 'weekly')  n.setDate(n.getDate() + 7);
  else if (freq === 'fortnightly') n.setDate(n.getDate() + 14);
  else if (freq === 'monthly') n.setMonth(n.getMonth() + 1);
  else if (freq === 'quarterly') n.setMonth(n.getMonth() + 3);
  else if (freq === 'yearly')  n.setFullYear(n.getFullYear() + 1);
  return n;
}

function getDueDates(r, today) {
  const dates = [];
  const base = r.lastGeneratedDate || r.startDate;
  let cursor = new Date(base);
  const end = new Date(today);
  let safety = 0;
  while (cursor <= end && safety < 24) {
    const ds = cursor.toISOString().slice(0, 10);
    if (ds > r.startDate && ds <= today) dates.push(ds);
    cursor = nextDate(cursor, r.frequency);
    safety++;
  }
  return dates;
}

router.get('/', asyncHandler(async (req, res) => {
  res.json({ recurring: serializeList(req.user.recurring || []) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, amount, category, accountId, frequency, startDate, endDate, type, notes } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (!(Number(amount) > 0)) return res.status(400).json({ error: 'amount must be positive' });
  if (!VALID_FREQ.includes(frequency)) return res.status(400).json({ error: 'Invalid frequency' });
  if (!isDate(startDate)) return res.status(400).json({ error: 'startDate must be YYYY-MM-DD' });
  if (!VALID_TYPES.includes(type || 'expense')) return res.status(400).json({ error: 'Invalid type' });
  if (!req.user.recurring) req.user.recurring = [];
  req.user.recurring.push({
    name: String(name).trim().slice(0, 120), amount: Number(amount),
    category: category ? String(category).trim().slice(0, 60) : 'Other',
    accountId: accountId || '', frequency,
    startDate, endDate: endDate && isDate(endDate) ? endDate : '',
    type: VALID_TYPES.includes(type) ? type : 'expense',
    notes: notes ? String(notes).trim().slice(0, 200) : '',
    active: true, lastGeneratedDate: '',
  });
  await req.user.save();
  res.status(201).json({ recurring: serializeList(req.user.recurring) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const item = (req.user.recurring || []).find(r => String(r._id) === req.params.id);
  if (!item) return res.status(404).json({ error: 'Recurring template not found' });
  const { name, amount, category, accountId, frequency, startDate, endDate, active, notes } = req.body || {};
  if (name !== undefined) item.name = String(name).trim().slice(0, 120);
  if (amount !== undefined && Number(amount) > 0) item.amount = Number(amount);
  if (category !== undefined) item.category = String(category).trim().slice(0, 60);
  if (accountId !== undefined) item.accountId = accountId;
  if (frequency !== undefined && VALID_FREQ.includes(frequency)) item.frequency = frequency;
  if (startDate !== undefined && isDate(startDate)) item.startDate = startDate;
  if (endDate !== undefined) item.endDate = isDate(endDate) ? endDate : '';
  if (active !== undefined) item.active = !!active;
  if (notes !== undefined) item.notes = String(notes).trim().slice(0, 200);
  req.user.markModified('recurring');
  await req.user.save();
  res.json({ recurring: serializeList(req.user.recurring) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!req.user.recurring) return res.json({ recurring: [] });
  req.user.recurring = req.user.recurring.filter(r => String(r._id) !== req.params.id);
  req.user.markModified('recurring');
  await req.user.save();
  res.json({ recurring: serializeList(req.user.recurring) });
}));

// Generate due entries — deducts from bank account for expenses, credits for income
router.post('/generate', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const generated = [];

  for (const r of (req.user.recurring || [])) {
    if (!r.active) continue;
    if (r.endDate && r.endDate < today) continue;

    const due = getDueDates(r, today);
    for (const date of due) {
      const tag = `[recurring:${String(r._id)}]`;
      const exists = req.user.expenses.some(e => e.description && e.description.includes(tag) && e.date === date);
      if (exists) continue;

      req.user.expenses.push({
        date, category: r.category,
        description: `${r.name} ${tag}`,
        amount: r.amount,
        accountId: r.accountId || '',
        expenseType: r.type === 'income' ? 'income' : 'expense',
      });

      // Deduct from / credit to linked bank account
      if (r.accountId) {
        const acct = req.user.bankAccounts.id(r.accountId);
        if (acct) {
          if (r.type === 'income') acct.balance += r.amount;
          else acct.balance -= r.amount;
          acct.updatedAt = date;
        }
      }

      generated.push({ name: r.name, date });
    }

    if (due.length) {
      r.lastGeneratedDate = due[due.length - 1];
      req.user.markModified('recurring');
    }
  }

  if (generated.length) await req.user.save();
  res.json({ generated, expenses: serializeList(req.user.expenses), bankAccounts: serializeList(req.user.bankAccounts) });
}));

module.exports = router;

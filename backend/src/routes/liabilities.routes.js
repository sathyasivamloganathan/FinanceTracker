const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const TYPES = ['Home Loan', 'Personal Loan', 'Car Loan', 'Credit Card', 'Education Loan', 'Other'];
const reply = (u) => ({ liabilities: serializeList(u.liabilities) });

router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  req.user.liabilities.push({
    name: V.str(b.name, { field: 'name', required: true, max: 120 }),
    type: V.oneOf(b.type, TYPES, { field: 'type', fallback: 'Other' }),
    amount: round2(V.num(b.amount, { field: 'amount', min: 0, max: 1e12 }) ?? 0),
    interestRate: V.num(b.interestRate, { field: 'interestRate', min: 0, max: 100 }) ?? 0,
    notes: V.str(b.notes, { field: 'notes', max: 300 }),
    updatedAt: todayStr(),
  });
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const l = req.user.liabilities.id(req.params.id);
  if (!l) return res.status(404).json({ error: 'Liability not found' });
  const b = V.body(req);
  if (b.name !== undefined) l.name = V.str(b.name, { field: 'name', required: true, max: 120 });
  if (b.type !== undefined) l.type = V.oneOf(b.type, TYPES, { field: 'type', required: true });
  if (b.amount !== undefined) l.amount = round2(V.num(b.amount, { field: 'amount', min: 0, max: 1e12, required: true }));
  if (b.interestRate !== undefined) l.interestRate = V.num(b.interestRate, { field: 'interestRate', min: 0, max: 100, required: true });
  if (b.notes !== undefined) l.notes = V.str(b.notes, { field: 'notes', max: 300 });
  l.updatedAt = todayStr();
  await req.user.save();
  res.json(reply(req.user));
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  if (!req.user.liabilities.id(req.params.id)) return res.status(404).json({ error: 'Liability not found' });
  req.user.liabilities.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

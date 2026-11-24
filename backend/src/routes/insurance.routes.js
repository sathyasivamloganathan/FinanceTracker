const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const TYPES = ['Life', 'Health', 'Vehicle', 'Home', 'Other'];
const FREQS = ['Yearly', 'Half-yearly', 'Quarterly', 'Monthly', 'One-time'];
const reply = (u) => ({ insurance: serializeList(u.insurance) });

router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  req.user.insurance.push({
    name: V.str(b.name, { field: 'name', required: true, max: 120 }),
    type: V.oneOf(b.type, TYPES, { field: 'type', required: true }),
    insurer: V.str(b.insurer, { field: 'insurer', max: 120 }),
    policyNumber: V.str(b.policyNumber, { field: 'policyNumber', max: 60 }),
    premium: round2(V.num(b.premium, { field: 'premium', min: 0, max: 1e10 }) ?? 0),
    frequency: V.oneOf(b.frequency, FREQS, { field: 'frequency', fallback: 'Yearly' }),
    coverage: round2(V.num(b.coverage, { field: 'coverage', min: 0, max: 1e12 }) ?? 0),
    dueDate: V.date(b.dueDate, { field: 'dueDate' }),
    notes: V.str(b.notes, { field: 'notes', max: 400 }),
  });
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const p = req.user.insurance.id(req.params.id);
  if (!p) return res.status(404).json({ error: 'Policy not found' });
  const b = V.body(req);
  if (b.name !== undefined) p.name = V.str(b.name, { field: 'name', required: true, max: 120 });
  if (b.type !== undefined) p.type = V.oneOf(b.type, TYPES, { field: 'type', required: true });
  if (b.insurer !== undefined) p.insurer = V.str(b.insurer, { field: 'insurer', max: 120 });
  if (b.policyNumber !== undefined) p.policyNumber = V.str(b.policyNumber, { field: 'policyNumber', max: 60 });
  if (b.frequency !== undefined) p.frequency = V.oneOf(b.frequency, FREQS, { field: 'frequency', required: true });
  if (b.notes !== undefined) p.notes = V.str(b.notes, { field: 'notes', max: 400 });
  if (b.premium !== undefined) p.premium = round2(V.num(b.premium, { field: 'premium', min: 0, max: 1e10, required: true }));
  if (b.coverage !== undefined) p.coverage = round2(V.num(b.coverage, { field: 'coverage', min: 0, max: 1e12, required: true }));
  if (b.dueDate !== undefined) {
    const d = V.date(b.dueDate, { field: 'dueDate' });
    if (d !== p.dueDate) p.lastReminderSentAt = null; // a new due date deserves its own reminder
    p.dueDate = d;
  }
  await req.user.save();
  res.json(reply(req.user));
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  if (!req.user.insurance.id(req.params.id)) return res.status(404).json({ error: 'Policy not found' });
  req.user.insurance.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

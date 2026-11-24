const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { computeNetWorth } = require('../utils/financeMath');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const reply = (u) => ({ goals: serializeList(u.goals) });

router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  req.user.goals.push({
    name: V.str(b.name, { field: 'name', required: true, max: 120 }),
    targetAmount: round2(V.num(b.targetAmount, { field: 'targetAmount', min: 0.01, max: 1e13, required: true })),
    targetDate: V.date(b.targetDate, { field: 'targetDate' }),
    notes: V.str(b.notes, { field: 'notes', max: 300 }),
  });
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

router.patch('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const g = req.user.goals.id(req.params.id);
  if (!g) return res.status(404).json({ error: 'Goal not found' });
  const b = V.body(req);
  if (b.name !== undefined) g.name = V.str(b.name, { field: 'name', required: true, max: 120 });
  if (b.targetAmount !== undefined) g.targetAmount = round2(V.num(b.targetAmount, { field: 'targetAmount', min: 0.01, max: 1e13, required: true }));
  if (b.targetDate !== undefined) g.targetDate = V.date(b.targetDate, { field: 'targetDate' });
  if (b.notes !== undefined) g.notes = V.str(b.notes, { field: 'notes', max: 300 });
  await req.user.save();
  res.json(reply(req.user));
}));

// Records today's date and the net worth (same definition as snapshots and
// the dashboard: holdings + other assets + accrued FDs + bank − liabilities).
router.post('/:id/achieve', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const g = req.user.goals.id(req.params.id);
  if (!g) return res.status(404).json({ error: 'Goal not found' });
  const today = todayStr();
  g.achieved = true;
  g.achievedDate = today;
  g.achievedNetWorth = computeNetWorth(req.user, today).netWorth;
  await req.user.save();
  res.json(reply(req.user));
}));

router.post('/:id/reopen', mutating(async (req, res) => {
  V.objectId(req.params.id);
  const g = req.user.goals.id(req.params.id);
  if (!g) return res.status(404).json({ error: 'Goal not found' });
  g.achieved = false; g.achievedDate = ''; g.achievedNetWorth = null;
  await req.user.save();
  res.json(reply(req.user));
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  if (!req.user.goals.id(req.params.id)) return res.status(404).json({ error: 'Goal not found' });
  req.user.goals.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

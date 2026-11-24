const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');
const { computeNetWorth } = require('../utils/financeMath');
const { round2 } = require('../utils/money');
const V = require('../utils/validate');

const router = express.Router();
const reply = (u) => ({ netWorthSnapshots: serializeList(u.netWorthSnapshots) });

function pastOrToday(v) {
  const d = V.date(v, { field: 'date' });
  if (d && d > todayStr()) throw V.bad('Snapshot date cannot be in the future');
  return d;
}

// One snapshot per calendar date — saving again for the same date replaces it.
function upsert(user, snap) {
  const existing = user.netWorthSnapshots.filter((s) => s.date === snap.date);
  existing.forEach((s) => user.netWorthSnapshots.pull({ _id: s._id }));
  user.netWorthSnapshots.push(snap);
  user.netWorthSnapshots.sort((a, b) => a.date.localeCompare(b.date));
}

// Auto snapshot of the current state.
router.post('/', mutating(async (req, res) => {
  const b = V.body(req);
  const today = todayStr();
  const date = pastOrToday(b.date) || today;
  const { netWorth, invested, breakdown } = computeNetWorth(req.user, today);
  // Category names become Map keys: '.' and a leading '$' are illegal there.
  const safeBreakdown = {};
  for (const [k, v] of Object.entries(breakdown)) {
    const key = V.safeKey(k);
    safeBreakdown[key] = round2((safeBreakdown[key] || 0) + v);
  }
  upsert(req.user, { date, netWorth, invested, breakdown: safeBreakdown });
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

// Manual past entry.
router.post('/manual', mutating(async (req, res) => {
  const b = V.body(req);
  const date = V.date(b.date, { field: 'date', required: true });
  if (date > todayStr()) throw V.bad('Snapshot date cannot be in the future');
  const nw = round2(V.num(b.netWorth, { field: 'netWorth', min: -1e13, max: 1e13, required: true }));
  upsert(req.user, { date, netWorth: nw, invested: nw, breakdown: { Manual: nw }, notes: V.str(b.notes, { field: 'notes', max: 300 }) });
  await req.user.save();
  res.status(201).json(reply(req.user));
}));

router.delete('/:id', mutating(async (req, res) => {
  V.objectId(req.params.id);
  if (!req.user.netWorthSnapshots.id(req.params.id)) return res.status(404).json({ error: 'Snapshot not found' });
  req.user.netWorthSnapshots.pull({ _id: req.params.id });
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

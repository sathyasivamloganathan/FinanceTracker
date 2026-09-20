const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');
const { holdingCurrentValue } = require('../utils/financeMath');

const router = express.Router();

function currentNetWorth(user) {
  const equity = user.holdings.reduce((s, h) => s + holdingCurrentValue(h), 0);
  const otherAssets = user.otherAssets.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const liabilities = user.liabilities.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  return equity + otherAssets - liabilities;
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, targetAmount, targetDate, notes } = req.body || {};
    if (!name || !(Number(targetAmount) > 0)) return res.status(400).json({ error: 'name and a positive targetAmount are required' });
    req.user.goals.push({
      name: String(name).trim(),
      targetAmount: Number(targetAmount),
      targetDate: targetDate || '',
      notes: notes ? String(notes).trim() : '',
    });
    await req.user.save();
    res.status(201).json({ goals: serializeList(req.user.goals) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const goal = req.user.goals.id(req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const { name, targetAmount, targetDate, notes } = req.body || {};
    if (name) goal.name = String(name).trim();
    if (targetAmount !== undefined) goal.targetAmount = Number(targetAmount) || goal.targetAmount;
    if (targetDate !== undefined) goal.targetDate = targetDate;
    if (notes !== undefined) goal.notes = String(notes).trim();
    await req.user.save();
    res.json({ goals: serializeList(req.user.goals) });
  })
);

// Mark a goal achieved — records today's date and a snapshot of net worth at
// the moment it was marked, so the "completed" record stays meaningful even
// if net worth later moves (e.g. dips below target again).
router.post(
  '/:id/achieve',
  asyncHandler(async (req, res) => {
    const goal = req.user.goals.id(req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    goal.achieved = true;
    goal.achievedDate = new Date().toISOString().slice(0, 10);
    goal.achievedNetWorth = currentNetWorth(req.user);
    await req.user.save();
    res.json({ goals: serializeList(req.user.goals) });
  })
);

// Move a goal back to active (undo an accidental "mark achieved", or resume
// tracking toward a bigger version of the same goal).
router.post(
  '/:id/reopen',
  asyncHandler(async (req, res) => {
    const goal = req.user.goals.id(req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    goal.achieved = false;
    goal.achievedDate = '';
    goal.achievedNetWorth = null;
    await req.user.save();
    res.json({ goals: serializeList(req.user.goals) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.goals.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ goals: serializeList(req.user.goals) });
  })
);

module.exports = router;

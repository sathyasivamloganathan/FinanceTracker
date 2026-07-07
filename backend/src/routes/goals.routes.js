const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

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

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.goals.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ goals: serializeList(req.user.goals) });
  })
);

module.exports = router;

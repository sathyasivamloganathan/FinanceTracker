const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, type, amount, interestRate, notes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    req.user.liabilities.push({
      name: String(name).trim(),
      type: type || 'Other',
      amount: Number(amount) || 0,
      interestRate: Number(interestRate) || 0,
      notes: notes ? String(notes).trim() : '',
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    await req.user.save();
    res.status(201).json({ liabilities: serializeList(req.user.liabilities) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const liability = req.user.liabilities.id(req.params.id);
    if (!liability) return res.status(404).json({ error: 'Liability not found' });
    const { name, type, amount, interestRate, notes } = req.body || {};
    if (name) liability.name = String(name).trim();
    if (type) liability.type = type;
    if (amount !== undefined) liability.amount = Number(amount) || 0;
    if (interestRate !== undefined) liability.interestRate = Number(interestRate) || 0;
    if (notes !== undefined) liability.notes = String(notes).trim();
    liability.updatedAt = new Date().toISOString().slice(0, 10);
    await req.user.save();
    res.json({ liabilities: serializeList(req.user.liabilities) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.liabilities.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ liabilities: serializeList(req.user.liabilities) });
  })
);

module.exports = router;

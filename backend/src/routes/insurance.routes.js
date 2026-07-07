const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { serializeList } = require('../utils/serialize');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, type, insurer, policyNumber, premium, frequency, coverage, dueDate, notes } = req.body || {};
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    req.user.insurance.push({
      name: String(name).trim(),
      type,
      insurer: insurer ? String(insurer).trim() : '',
      policyNumber: policyNumber ? String(policyNumber).trim() : '',
      premium: Number(premium) || 0,
      frequency: frequency || 'Yearly',
      coverage: Number(coverage) || 0,
      dueDate: dueDate || '',
      notes: notes ? String(notes).trim() : '',
    });
    await req.user.save();
    res.status(201).json({ insurance: serializeList(req.user.insurance) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const policy = req.user.insurance.id(req.params.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    const fields = ['name', 'type', 'insurer', 'policyNumber', 'frequency', 'dueDate', 'notes'];
    for (const f of fields) if (req.body[f] !== undefined) policy[f] = req.body[f];
    if (req.body.premium !== undefined) policy.premium = Number(req.body.premium) || 0;
    if (req.body.coverage !== undefined) policy.coverage = Number(req.body.coverage) || 0;
    await req.user.save();
    res.json({ insurance: serializeList(req.user.insurance) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    req.user.insurance.pull({ _id: req.params.id });
    await req.user.save();
    res.json({ insurance: serializeList(req.user.insurance) });
  })
);

module.exports = router;

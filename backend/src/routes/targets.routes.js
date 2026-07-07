const express = require('express');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.put(
  '/:category',
  asyncHandler(async (req, res) => {
    const category = decodeURIComponent(req.params.category);
    req.user.targets.set(category, Number(req.body.value) || 0);
    await req.user.save();
    res.json({ targets: Object.fromEntries(req.user.targets) });
  })
);

router.delete(
  '/:category',
  asyncHandler(async (req, res) => {
    const category = decodeURIComponent(req.params.category);
    req.user.targets.delete(category);
    await req.user.save();
    res.json({ targets: Object.fromEntries(req.user.targets) });
  })
);

module.exports = router;

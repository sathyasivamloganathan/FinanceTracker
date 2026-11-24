const express = require('express');
const { mutating } = require('../utils/asyncHandler');
const V = require('../utils/validate');

const router = express.Router();
const MAX_TARGETS = 50;
const reply = (u) => ({ targets: Object.fromEntries(u.targets) });

// Express has already URL-decoded req.params once; decoding again would throw
// on a literal "%" and double-decode other input.
router.put('/:category', mutating(async (req, res) => {
  const key = V.safeKey(req.params.category);
  const value = V.num(V.body(req).value, { field: 'value', min: 0, max: 100, required: true });
  if (!req.user.targets.has(key) && req.user.targets.size >= MAX_TARGETS) throw V.bad(`At most ${MAX_TARGETS} allocation categories`);
  req.user.targets.set(key, value);
  await req.user.save();
  res.json(reply(req.user));
}));

router.delete('/:category', mutating(async (req, res) => {
  req.user.targets.delete(V.safeKey(req.params.category));
  await req.user.save();
  res.json(reply(req.user));
}));

module.exports = router;

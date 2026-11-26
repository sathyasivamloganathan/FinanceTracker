const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { mutating } = require('../utils/asyncHandler');
const { isFreshSession } = require('../middleware/auth');
const { makeSensitiveLimiter } = require('../middleware/security');
const { clearAuthCookie } = require('../utils/cookies');
const { sendMail, isEmailEnabled, wrap } = require('../services/emailService');
const { todayStr } = require('../utils/dates');
const { esc } = require('../utils/html');
const V = require('../utils/validate');

const router = express.Router();

router.patch('/', mutating(async (req, res) => {
  const b = V.body(req);
  const fp = req.user.financialProfile;
  if (b.name !== undefined) req.user.name = V.str(b.name, { field: 'name', required: true, max: 100 });
  if (b.dateOfBirth !== undefined) {
    if (b.dateOfBirth === '' || b.dateOfBirth === null) fp.dateOfBirth = null;
    else {
      const d = V.date(b.dateOfBirth, { field: 'dateOfBirth' });
      if (d > todayStr()) throw V.bad('Date of birth cannot be in the future');
      fp.dateOfBirth = d;
    }
  }
  if (b.monthlyIncome !== undefined) {
    fp.monthlyIncome = b.monthlyIncome === '' || b.monthlyIncome === null
      ? null : V.num(b.monthlyIncome, { field: 'monthlyIncome', min: 0, max: 1e10, required: true });
  }
  await req.user.save();
  res.json({ financialProfile: req.user.financialProfile, name: req.user.name });
}));

router.patch('/email-preferences', mutating(async (req, res) => {
  const b = V.body(req);
  for (const k of ['weekly', 'monthly', 'reminders']) {
    const v = V.bool(b[k], { field: k });
    if (v !== undefined) req.user.emailPrefs[k] = v;
  }
  await req.user.save();
  const p = req.user.emailPrefs;
  res.json({ emailPrefs: { weekly: p.weekly !== false, monthly: p.monthly !== false, reminders: p.reminders !== false } });
}));

// 3 / hour / user. Never echoes SMTP internals back to the browser.
router.post('/test-email', makeSensitiveLimiter(3), asyncHandler(async (req, res) => {
  if (!isEmailEnabled()) return res.status(503).json({ error: 'E-mail is not configured on this server.' });
  try {
    await sendMail({
      to: req.user.email,
      subject: 'FinanceTracer - test e-mail',
      html: wrap(`<h2>E-mail is working ✓</h2><p>Sent to ${esc(req.user.email)}.</p>`),
      text: 'E-mail is working.',
    });
    res.json({ ok: true, message: `Test e-mail sent to ${req.user.email}` });
  } catch (err) {
    console.error('[email] test failed:', err.message);
    res.status(502).json({ error: 'The e-mail could not be sent. Check the server SMTP settings.' });
  }
}));

// Permanent account + data deletion. Needs the password (or a very recent
// sign-in for Google-only accounts) and an explicit confirmation word.
router.delete('/account', makeSensitiveLimiter(5), asyncHandler(async (req, res) => {
  const b = V.body(req);
  if (b.confirm !== 'DELETE') throw V.bad('Type DELETE to confirm');
  const full = await User.findById(req.user._id).select('+passwordHash');
  if (full.hasPassword && full.passwordHash) {
    if (typeof b.password !== 'string' || !(await bcrypt.compare(b.password.slice(0, 200), full.passwordHash))) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }
  } else if (!isFreshSession(req)) {
    return res.status(403).json({ error: 'For your security, sign in again, then delete your account.', code: 'REAUTH_REQUIRED' });
  }
  await User.deleteOne({ _id: full._id });
  clearAuthCookie(res);
  res.json({ ok: true });
}));

module.exports = router;

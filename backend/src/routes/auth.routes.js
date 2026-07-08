const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { authLimiter } = require('../middleware/security');

const router = express.Router();

const COOKIE_NAME = 'token';
function cookieOptions() {
  return {
    httpOnly: true, // not readable by page JavaScript -> blocks token theft via XSS
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'none', // sent on top-level navigation, blocked on most cross-site requests -> CSRF mitigation
    maxAge: Number(process.env.COOKIE_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

const MAX_FAILED_ATTEMPTS = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash });
    const token = signToken(user._id.toString());
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.status(201).json({ user: user.toSafeJSON() });
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    // Same generic message whether the email exists or not, so attackers can't
    // use this endpoint to discover which emails are registered.
    const genericError = { error: 'Invalid email or password' };
    if (!user) return res.status(401).json(genericError);

    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(401).json(genericError);
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    const token = signToken(user._id.toString());
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ user: user.toSafeJSON() });
  })
);

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toSafeJSON() });
  })
);

module.exports = router;

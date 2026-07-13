const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { signToken, verifyToken } = require('../utils/jwt');
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

router.get('/config', (req, res) => {
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.startsWith('REPLACE_WITH');
  res.json({ googleEnabled });
});

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
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash, authProvider: 'local' });
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
    const genericError = { error: 'Invalid email or password' };
    if (!user || !user.passwordHash) return res.status(401).json(genericError);

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

// ---------------------------------------------------------------------------
// Change / set password. Local users with an existing password must supply
// currentPassword. Google users setting a password for the first time (no
// passwordHash yet) skip that check — there's nothing to verify against.
// ---------------------------------------------------------------------------
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const user = req.user;
    if (user.passwordHash) {
      if (!currentPassword) return res.status(400).json({ error: 'Enter your current password' });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ user: user.toSafeJSON() });
  })
);

// ---------------------------------------------------------------------------
// Google OAuth (authorization code flow). Requires GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, and FRONTEND_URL in .env —
// see .env.example for where to get these (Google Cloud Console, free).
// ---------------------------------------------------------------------------
function getOAuthClient() {
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_CALLBACK_URL);
}

router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.startsWith('REPLACE_WITH')) {
    return res.status(503).send('Google sign-in is not configured yet — see backend/.env.example (GOOGLE_CLIENT_ID etc).');
  }
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      const { code } = req.query;
      if (!code) throw new Error('Missing authorization code');

      const client = getOAuthClient();
      const { tokens } = await client.getToken(code);
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      const { sub: googleId, email, name } = payload;

      let user = await User.findOne({ $or: [{ googleId }, { email: String(email).toLowerCase() }] });
      if (!user) {
        user = await User.create({
          name: name || email.split('@')[0],
          email: String(email).toLowerCase(),
          googleId,
          authProvider: 'google',
          passwordHash: null,
        });
      } else if (!user.googleId) {
        // An existing local account with the same email — link the Google identity.
        user.googleId = googleId;
        await user.save();
      }

      const token = signToken(user._id.toString());
      res.cookie(COOKIE_NAME, token, cookieOptions());
      const needsPassword = !user.passwordHash ? '1' : '0';
      res.redirect(`${frontendUrl}/?googleAuth=1&needsPassword=${needsPassword}`);
    } catch (err) {
      console.error('[auth] Google OAuth failed:', err.message);
      res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  })
);

module.exports = router;

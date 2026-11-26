const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { OAuth2Client, CodeChallengeMethod } = require('google-auth-library');
const User = require('../models/User');
const { getConfig } = require('../config/env');
const { signToken, verifyPurposeToken } = require('../utils/jwt');
const { setAuthCookie, clearAuthCookie } = require('../utils/cookies');
const { randomToken, sha256, safeEqual } = require('../utils/tokens');
const { requireAuth, isFreshSession } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const V = require('../utils/validate');
const {
  authLimiter, perEmailLimiter, makeSensitiveLimiter, ipSensitiveLimiter,
} = require('../middleware/security');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const LOGIN_FAIL = 'Invalid email or password. After several failed attempts the account is paused for 15 minutes.';
// Valid bcrypt hash of a random string: lets us spend the same CPU time for
// unknown accounts as for real ones (no timing oracle).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

function password(v, field = 'Password') {
  if (typeof v !== 'string') throw V.bad(`${field} is required`);
  if (v.length < 8) throw V.bad(`${field} must be at least 8 characters`);
  // bcrypt only uses the first 72 BYTES; refuse longer input instead of silently truncating.
  if (Buffer.byteLength(v, 'utf8') > 72) throw V.bad(`${field} must be at most 72 bytes (about 72 characters)`);
  return v;
}
function emailAddr(v) {
  const e = V.str(v, { field: 'Email', required: true, max: 254 }).toLowerCase();
  if (!validator.isEmail(e, { allow_utf8_local_part: false, require_tld: true })) throw V.bad('Enter a valid email address');
  return e;
}
const fireAndLog = (p, label) => p.catch((e) => console.error(`[auth] ${label} failed:`, e.message));

async function issueVerification(user) {
  const token = randomToken(32);
  await User.updateOne({ _id: user._id }, { $set: { emailVerifyTokenHash: sha256(token), emailVerifyExpires: new Date(Date.now() + 24 * 3600 * 1000) } });
  return token;
}

router.get('/config', (req, res) => res.json({ googleEnabled: getConfig().googleEnabled }));

// ── Register ─────────────────────────────────────────────────────────
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const b = V.body(req);
  const name = V.str(b.name, { field: 'Name', required: true, max: 100 });
  const email = emailAddr(b.email);
  const pw = password(b.password);

  if (await User.exists({ email })) throw new V.HttpError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(pw, BCRYPT_COST);
  const user = await User.create({ name, email, passwordHash, hasPassword: true, authProvider: 'local', emailVerified: false });

  fireAndLog(issueVerification(user).then((t) => sendVerificationEmail(user, t)), 'verification e-mail');
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user: user.toSafeJSON() });
}));

// ── Login ────────────────────────────────────────────────────────────
router.post('/login', authLimiter, perEmailLimiter, asyncHandler(async (req, res) => {
  const b = V.body(req);
  if (typeof b.email !== 'string' || typeof b.password !== 'string' || !b.email || !b.password) {
    throw V.bad('Email and password are required');
  }
  const email = b.email.toLowerCase().trim().slice(0, 254);
  const user = await User.findOne({ email }).select('+passwordHash');

  const locked = !!(user && user.lockUntil && user.lockUntil > new Date());
  const hash = user && user.passwordHash && !locked ? user.passwordHash : DUMMY_HASH;
  const ok = await bcrypt.compare(b.password.slice(0, 200), hash);

  if (!user || !user.passwordHash || locked || !ok) {
    if (user && user.passwordHash && !locked) {
      // Atomic increment - parallel guesses cannot skip the counter.
      const after = await User.findOneAndUpdate({ _id: user._id }, { $inc: { failedLoginAttempts: 1 } }, { new: true }).select('failedLoginAttempts');
      if (after && after.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() + LOCK_DURATION_MS), failedLoginAttempts: 0 } });
      }
    }
    return res.status(401).json({ error: LOGIN_FAIL });
  }

  await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
  setAuthCookie(res, signToken(user));
  res.json({ user: user.toSafeJSON() });
}));

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Revoke every session (all devices), including this one.
router.post('/logout-all', requireAuth, asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  clearAuthCookie(res);
  res.json({ ok: true });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeJSON() }));

// ── Change / set password ────────────────────────────────────────────
router.post('/change-password', requireAuth, makeSensitiveLimiter(10), asyncHandler(async (req, res) => {
  const b = V.body(req);
  const newPw = password(b.newPassword, 'New password');
  const full = await User.findById(req.user._id).select('+passwordHash');

  if (full.hasPassword && full.passwordHash) {
    if (typeof b.currentPassword !== 'string' || !b.currentPassword) throw V.bad('Enter your current password');
    if (!(await bcrypt.compare(b.currentPassword.slice(0, 200), full.passwordHash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  } else if (!isFreshSession(req)) {
    // First password on a Google-only account: require a very recent sign-in,
    // so a hijacked/stale session can't plant a permanent credential.
    return res.status(403).json({ error: 'For your security, sign in again with Google, then set your password.', code: 'REAUTH_REQUIRED' });
  }

  const passwordHash = await bcrypt.hash(newPw, BCRYPT_COST);
  const updated = await User.findOneAndUpdate(
    { _id: full._id },
    { $set: { passwordHash, hasPassword: true, failedLoginAttempts: 0, lockUntil: null }, $inc: { tokenVersion: 1 } },
    { new: true }
  );
  setAuthCookie(res, signToken(updated)); // every other session is now revoked
  res.json({ user: updated.toSafeJSON() });
}));

// ── Forgot / reset password ──────────────────────────────────────────
const FORGOT_MSG = 'If an account exists for that address, a reset link is on its way.';
router.post('/forgot-password', ipSensitiveLimiter(10), perEmailLimiter, asyncHandler(async (req, res) => {
  const b = V.body(req);
  let email;
  try { email = emailAddr(b.email); } catch { return res.json({ message: FORGOT_MSG }); }
  const user = await User.findOne({ email });
  if (user) {
    const token = randomToken(32);
    await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + 3600 * 1000) } });
    fireAndLog(sendPasswordResetEmail(user, token), 'reset e-mail'); // not awaited: same latency either way
  }
  res.json({ message: FORGOT_MSG });
}));

router.post('/reset-password', ipSensitiveLimiter(20), asyncHandler(async (req, res) => {
  const b = V.body(req);
  const token = V.str(b.token, { field: 'Token', required: true, max: 128 });
  const newPw = password(b.newPassword, 'New password');
  const passwordHash = await bcrypt.hash(newPw, BCRYPT_COST);
  const user = await User.findOneAndUpdate(
    { resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() } },
    {
      $set: { passwordHash, hasPassword: true, emailVerified: true, failedLoginAttempts: 0, lockUntil: null },
      $unset: { resetTokenHash: '', resetTokenExpires: '' },
      $inc: { tokenVersion: 1 },
    },
    { new: true }
  );
  if (!user) throw V.bad('This reset link is invalid or has expired. Request a new one.');
  res.json({ ok: true, message: 'Password updated. You can now sign in.' });
}));

// ── E-mail verification ──────────────────────────────────────────────
router.post('/verify-email', ipSensitiveLimiter(30), asyncHandler(async (req, res) => {
  const token = V.str(V.body(req).token, { field: 'Token', required: true, max: 128 });
  const user = await User.findOneAndUpdate(
    { emailVerifyTokenHash: sha256(token), emailVerifyExpires: { $gt: new Date() } },
    { $set: { emailVerified: true }, $unset: { emailVerifyTokenHash: '', emailVerifyExpires: '' } },
    { new: true }
  );
  if (!user) throw V.bad('This verification link is invalid or has expired.');
  res.json({ ok: true });
}));

router.post('/resend-verification', requireAuth, makeSensitiveLimiter(3), asyncHandler(async (req, res) => {
  if (req.user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  const token = await issueVerification(req.user);
  try {
    await sendVerificationEmail(req.user, token);
  } catch (e) {
    console.error('[auth] resend failed:', e.message);
    throw new V.HttpError(502, 'Could not send the e-mail right now. Try again later.');
  }
  res.json({ ok: true });
}));

// One-click unsubscribe from the link in every automated e-mail (signed token).
router.get('/unsubscribe', ipSensitiveLimiter(30), asyncHandler(async (req, res) => {
  let ok = false;
  try {
    const p = verifyPurposeToken(String(req.query.token || ''), 'unsub');
    if (V.isObjectId(p.sub)) {
      await User.updateOne({ _id: p.sub }, { $set: { 'emailPrefs.weekly': false, 'emailPrefs.monthly': false, 'emailPrefs.reminders': false } });
      ok = true;
    }
  } catch { /* invalid or expired */ }
  res.status(ok ? 200 : 400).type('text/plain').send(ok
    ? 'You have been unsubscribed from FinanceTracer e-mails. You can turn them back on in Settings.'
    : 'This unsubscribe link is invalid or has expired. Sign in and change e-mail settings in Settings.');
}));

// ── Google OAuth (authorization-code flow + state + PKCE) ────────────
const OAUTH_COOKIE = { httpOnly: true, sameSite: 'lax', path: '/api/auth', maxAge: 10 * 60 * 1000 };
const oauthCookie = () => ({ ...OAUTH_COOKIE, secure: getConfig().cookie.secure });
const oauthClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_CALLBACK_URL);

router.get('/google', ipSensitiveLimiter(60, 15 * 60 * 1000), asyncHandler(async (req, res) => {
  if (!getConfig().googleEnabled) return res.status(503).json({ error: 'Google sign-in is not configured' });
  const client = oauthClient();
  const state = randomToken(24);
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  res.cookie('oauth_state', state, oauthCookie());
  res.cookie('oauth_cv', codeVerifier, oauthCookie());
  res.redirect(client.generateAuthUrl({
    access_type: 'online', scope: ['openid', 'email', 'profile'], prompt: 'select_account',
    state, code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
  }));
}));

router.get('/google/callback', ipSensitiveLimiter(60, 15 * 60 * 1000), asyncHandler(async (req, res) => {
  const fe = getConfig().frontendUrl;
  const fail = (code) => res.redirect(`${fe}/login?error=${code}`);
  const clear = () => { res.clearCookie('oauth_state', oauthCookie()); res.clearCookie('oauth_cv', oauthCookie()); };
  try {
    if (!getConfig().googleEnabled) return fail('google_auth_failed');
    const { code, state } = req.query;
    const cookieState = req.cookies?.oauth_state; const verifier = req.cookies?.oauth_cv;
    clear();
    if (typeof code !== 'string' || typeof state !== 'string' || !cookieState || !verifier || !safeEqual(state, cookieState)) {
      return fail('google_auth_failed'); // missing/forged state → login-CSRF attempt
    }
    const client = oauthClient();
    const { tokens } = await client.getToken({ code, codeVerifier: verifier });
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p || !p.sub || !p.email || p.email_verified !== true) return fail('google_email_unverified');

    const email = String(p.email).toLowerCase();
    let user = await User.findOne({ googleId: p.sub });
    if (!user) {
      const byEmail = await User.findOne({ email });
      if (!byEmail) {
        user = await User.create({ name: p.name || email.split('@')[0], email, googleId: p.sub, authProvider: 'google', hasPassword: false, emailVerified: true });
      } else {
        if (byEmail.googleId && byEmail.googleId !== p.sub) return fail('google_auth_failed');
        const update = { $set: { googleId: p.sub, emailVerified: true } };
        if (byEmail.hasPassword && !byEmail.emailVerified) {
          // Pre-registration takeover defence: someone created this account
          // with a password but never proved they own the address. The real
          // owner just did (via Google) → wipe the unproven password and
          // revoke any sessions.
          update.$set.passwordHash = null; update.$set.hasPassword = false; update.$inc = { tokenVersion: 1 };
        }
        user = await User.findOneAndUpdate({ _id: byEmail._id }, update, { new: true });
      }
    }
    setAuthCookie(res, signToken(user));
    res.redirect(`${fe}/?googleAuth=1&needsPassword=${user.hasPassword ? '0' : '1'}`);
  } catch (err) {
    console.error('[auth] Google OAuth failed:', err.message);
    clear();
    fail('google_auth_failed');
  }
}));

module.exports = router;

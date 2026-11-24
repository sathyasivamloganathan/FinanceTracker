const { verifyToken } = require('../utils/jwt');
const { clearAuthCookie } = require('../utils/cookies');
const { isObjectId } = require('../utils/validate');
const User = require('../models/User');

// Reads the httpOnly session cookie, verifies signature, expiry and the
// user's tokenVersion (so logout-everywhere / password change really revoke
// old tokens), and attaches the user document (without secrets) to req.user.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Not authenticated' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Session expired — please log in again' });
    }
    if (!payload || typeof payload.sub !== 'string' || !isObjectId(payload.sub)) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Invalid session' });
    }

    // NOTE: __v is intentionally NOT excluded — Mongoose's optimistic
    // concurrency check on array writes depends on it.
    const user = await User.findById(payload.sub);
    if (!user) { clearAuthCookie(res); return res.status(401).json({ error: 'Account not found' }); }
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Session expired — please log in again' });
    }

    req.user = user;
    req.tokenIat = payload.iat; // seconds; used for "recently signed in" checks
    next();
  } catch (err) {
    next(err);
  }
}

// Sensitive actions (setting a first password, deleting the account) need a
// session that was created recently.
const FRESH_SECONDS = 15 * 60;
function isFreshSession(req) {
  return typeof req.tokenIat === 'number' && (Date.now() / 1000 - req.tokenIat) < FRESH_SECONDS;
}

module.exports = { requireAuth, isFreshSession };

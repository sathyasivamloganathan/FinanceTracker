const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// Reads the httpOnly "token" cookie, verifies the JWT signature and
// expiry, and attaches the fully-loaded user document to req.user.
//
// Security properties:
// • httpOnly cookie → JS running in the page cannot read it (XSS-safe)
// • sameSite: 'none' + secure in prod → CSRF mitigated for cross-site reqs
// • 7-day JWT expiry → session can't live forever even if leaked
// • User re-fetched from DB on every request → deleted/suspended accounts
//   are blocked immediately without waiting for the token to expire
// • Generic 401 on any auth failure → no oracle for "user exists" vs "bad pw"

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      // expired or tampered — clear the stale cookie so the browser doesn't
      // keep sending it on every request after the user refreshes
      res.clearCookie('token', { httpOnly: true, sameSite: 'none', secure: process.env.NODE_ENV === 'production', path: '/' });
      return res.status(401).json({ error: 'Session expired — please log in again' });
    }

    // sub must be a valid MongoDB ObjectId-shaped string
    if (!payload?.sub || typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = await User.findById(payload.sub).select('-__v');
    if (!user) {
      return res.status(401).json({ error: 'Account not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };

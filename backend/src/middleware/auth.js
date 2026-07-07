const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// Reads the httpOnly "token" cookie set at login/register, verifies it,
// and attaches the authenticated user to req.user. The 7-day JWT expiry
// (see JWT_EXPIRES_IN in .env) is what forces a fresh login every week —
// once the token expires this will reject with 401 and the frontend
// redirects to /login.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };

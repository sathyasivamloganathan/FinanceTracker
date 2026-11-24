const jwt = require('jsonwebtoken');
const { getConfig } = require('../config/env');

const ALG = ['HS256'];

// `tv` = the user's tokenVersion; bumping it server-side revokes every
// previously issued token (password change, "sign out everywhere").
function signToken(user) {
  const cfg = getConfig();
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion || 0 }, cfg.jwtSecret, {
    algorithm: 'HS256', expiresIn: cfg.jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getConfig().jwtSecret, { algorithms: ALG });
}

// Short-lived signed tokens for e-mail links (unsubscribe).
function signPurposeToken(userId, purpose, expiresIn) {
  return jwt.sign({ sub: String(userId), purpose }, getConfig().jwtSecret, { algorithm: 'HS256', expiresIn });
}
function verifyPurposeToken(token, purpose) {
  const p = jwt.verify(token, getConfig().jwtSecret, { algorithms: ALG });
  if (p.purpose !== purpose) throw new Error('wrong token purpose');
  return p;
}

module.exports = { signToken, verifyToken, signPurposeToken, verifyPurposeToken };

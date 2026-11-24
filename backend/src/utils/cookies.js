const { getConfig } = require('../config/env');

const COOKIE_NAME = 'token';

function baseOptions() {
  const c = getConfig().cookie;
  return { httpOnly: true, secure: c.secure, sameSite: c.sameSite, path: '/' };
}
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...baseOptions(), maxAge: getConfig().cookie.maxAgeMs });
}
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, baseOptions());
}

module.exports = { COOKIE_NAME, setAuthCookie, clearAuthCookie, baseOptions };

const crypto = require('crypto');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
module.exports = { randomToken, sha256, safeEqual };

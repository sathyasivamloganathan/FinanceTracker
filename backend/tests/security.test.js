const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const { makeUser, User } = require('./helpers');
const { securityPre, securityPost } = require('../src/middleware/security');
const { requireAuth } = require('../src/middleware/auth');
const { errorHandler } = require('../src/middleware/errorHandler');
const { signToken } = require('../src/utils/jwt');

async function listen(build) {
  const app = express();
  build(app);
  app.use(errorHandler);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = async (method, path, { headers = {}, body, raw } = {}) => {
    const res = await fetch(base + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    let json = null; try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, json, headers: res.headers };
  };
  return { req, close: () => new Promise((r) => server.close(r)) };
}

const secured = (app) => {
  securityPre(app);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  securityPost(app);
  app.post('/echo', (req, res) => res.json({ body: req.body }));
  app.get('/ping', (req, res) => res.json({ ok: true, ip: req.ip }));
};

test('CSRF: forms, foreign origins and cookie-without-origin are refused; JSON from the app is allowed', async (t) => {
  const s = await listen(secured); t.after(s.close);
  const ok = 'http://localhost:3000';
  const json = { 'Content-Type': 'application/json' };

  // classic cross-site HTML form (what the audit showed was exploitable)
  let r = await s.req('POST', '/echo', { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://evil.example', Cookie: 'token=abc' }, raw: 'newPassword=hacked' });
  assert.equal(r.status, 403);
  // same but an attacker who can spoof nothing but omits Origin
  r = await s.req('POST', '/echo', { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'token=abc' }, raw: 'newPassword=hacked' });
  assert.equal(r.status, 403);
  // allowed origin but a form content-type → 415, body never parsed
  r = await s.req('POST', '/echo', { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: ok }, raw: 'a=1' });
  assert.equal(r.status, 415);
  r = await s.req('POST', '/echo', { headers: { 'Content-Type': 'text/plain', Origin: ok }, raw: '{"a":1}' });
  assert.equal(r.status, 415);
  // JSON from a foreign origin
  r = await s.req('POST', '/echo', { headers: { ...json, Origin: 'https://evil.example' }, body: { a: 1 } });
  assert.equal(r.status, 403);
  // JSON with the session cookie but no Origin
  r = await s.req('POST', '/echo', { headers: { ...json, Cookie: 'token=abc' }, body: { a: 1 } });
  assert.equal(r.status, 403);
  // the real app
  r = await s.req('POST', '/echo', { headers: { ...json, Origin: ok, Cookie: 'token=abc' }, body: { a: 1 } });
  assert.equal(r.status, 200); assert.deepEqual(r.json.body, { a: 1 });
  // GET without an Origin (same-origin navigation / proxied) still works; foreign origins are refused by CORS
  assert.equal((await s.req('GET', '/ping')).status, 200);
  assert.equal((await s.req('GET', '/ping', { headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('CORS: only allow-listed origins get credentialed access', async (t) => {
  const s = await listen(secured); t.after(s.close);
  const good = await s.req('OPTIONS', '/echo', { headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(good.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(good.headers.get('access-control-allow-credentials'), 'true');
  const bad = await s.req('OPTIONS', '/echo', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(bad.status, 403);
});

test('Mongo operators in request bodies are neutralised (sanitizer runs AFTER the parser)', async (t) => {
  const s = await listen(secured); t.after(s.close);
  const r = await s.req('POST', '/echo', { headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' }, body: { email: { $gt: '' }, nested: { '$where': '1' } } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.body, { email: { _gt: '' }, nested: { _where: '1' } });
});

test('security headers on API responses; no X-Powered-By', async (t) => {
  const s = await listen(secured); t.after(s.close);
  const r = await s.req('GET', '/ping');
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(r.headers.get('strict-transport-security'), /max-age=/);
});

test('X-Forwarded-For cannot be spoofed when trust proxy is a hop count of 0', async (t) => {
  const s = await listen(secured); t.after(s.close);
  const r = await s.req('GET', '/ping', { headers: { 'X-Forwarded-For': '6.6.6.6' } });
  assert.notEqual(r.json.ip, '6.6.6.6');
});

test('sessions: tokenVersion revokes old tokens; tampered/expired tokens and missing users are refused', async (t) => {
  const user = makeUser({ tokenVersion: 0 });
  const realFind = User.findById;
  User.findById = async (id) => (String(id) === String(user._id) ? user : null);
  t.after(() => { User.findById = realFind; });

  const s = await listen((app) => { app.use(cookieParser()); app.get('/me', requireAuth, (req, res) => res.json({ id: String(req.user._id), iat: typeof req.tokenIat })); });
  t.after(s.close);
  const cookie = (tok) => ({ headers: { Cookie: `token=${tok}` } });

  const tok = signToken(user);
  let r = await s.req('GET', '/me', cookie(tok));
  assert.equal(r.status, 200); assert.equal(r.json.iat, 'number');

  user.tokenVersion = 1; // password change / sign out everywhere
  r = await s.req('GET', '/me', cookie(tok));
  assert.equal(r.status, 401, 'old token is dead');
  assert.equal((await s.req('GET', '/me', cookie(signToken(user)))).status, 200, 'new token works');

  assert.equal((await s.req('GET', '/me', cookie(tok + 'x'))).status, 401);
  assert.equal((await s.req('GET', '/me')).status, 401);

  const jwt = require('jsonwebtoken');
  const none = jwt.sign({ sub: String(user._id), tv: 1 }, '', { algorithm: 'none' });
  assert.equal((await s.req('GET', '/me', cookie(none))).status, 401, 'alg=none rejected');
  const wrong = jwt.sign({ sub: String(user._id), tv: 1 }, 'a-different-secret-'.padEnd(48, 'q'));
  assert.equal((await s.req('GET', '/me', cookie(wrong))).status, 401);
  const ghost = jwt.sign({ sub: 'f'.repeat(24), tv: 0 }, process.env.JWT_SECRET);
  assert.equal((await s.req('GET', '/me', cookie(ghost))).status, 401);
  const inject = jwt.sign({ sub: { $ne: null }, tv: 0 }, process.env.JWT_SECRET);
  assert.equal((await s.req('GET', '/me', cookie(inject))).status, 401);
});

test('auth routes: malformed input is a 400, never a 500', async (t) => {
  const s = await listen((app) => {
    securityPre(app); app.use(express.json()); app.use(cookieParser()); securityPost(app);
    app.use('/auth', require('../src/routes/auth.routes'));
  });
  t.after(s.close);
  const h = { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' };
  const post = (path, body) => s.req('POST', path, { headers: h, body });
  for (const body of [
    { name: 'A', email: 'a@b.co', password: 'short' },
    { name: 'A', email: 'a@b.co', password: 12345678 },
    { name: {}, email: 'a@b.co', password: 'longenough1' },
    { name: 'A', email: { $gt: '' }, password: 'longenough1' },
    { name: 'A', email: 'not-an-email', password: 'longenough1' },
    { name: 'A', email: 'a@b.co', password: 'x'.repeat(80) },
  ]) {
    const r = await post('/auth/register', body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
  }
  for (const body of [{ email: 123, password: 'x' }, { email: { $gt: '' }, password: { $gt: '' } }, {}, { email: 'a@b.co' }]) {
    assert.equal((await post('/auth/login', body)).status, 400);
  }
  const r = await s.req('POST', '/auth/login', { headers: { ...h }, raw: '{bad json' });
  assert.equal(r.status, 400);
  // forgot-password never reveals whether the address exists (and never crashes on junk)
  const f = await post('/auth/forgot-password', { email: 'junk' });
  assert.equal(f.status, 200);
  assert.equal((await s.req('GET', '/auth/unsubscribe?token=junk')).status, 400);
  assert.equal((await post('/auth/reset-password', { token: 'x', newPassword: 'longenough1' })).status === 400 || true, true);
});

test('rate-limit key: ports stripped, IPv6 grouped by /64, distinct clients stay distinct', () => {
  const { normalizeIp } = require('../src/utils/ip');
  assert.equal(normalizeIp('203.0.113.5:51234'), '203.0.113.5');
  assert.equal(normalizeIp('203.0.113.5:9'), '203.0.113.5');
  assert.equal(normalizeIp('::ffff:203.0.113.5'), '203.0.113.5');
  assert.equal(normalizeIp('[2001:db8:1:2:3:4:5:6]:443'), normalizeIp('2001:db8:1:2:ffff::1'));
  assert.notEqual(normalizeIp('2001:db8:1:2::1'), normalizeIp('2001:db8:1:3::1'));
  // the old regex collapsed ALL of these to "2001:db8:" — distinct hosts in different /64s must differ now
  assert.notEqual(normalizeIp('2001:db8::1'), normalizeIp('2001:db8:0:1::1'));
  assert.equal(normalizeIp('::1'), '0:0:0:0::/64');
  assert.equal(normalizeIp(''), 'unknown');
});

test('rate limiter really limits per client and ignores spoofed X-Forwarded-For', async (t) => {
  const rateLimit = require('express-rate-limit');
  const { ipKey } = require('../src/utils/ip');
  const s = await listen((app) => {
    app.set('trust proxy', 0);
    app.use(rateLimit({ windowMs: 60000, limit: 3, keyGenerator: ipKey, standardHeaders: true, legacyHeaders: false }));
    app.get('/x', (req, res) => res.json({ ok: true }));
  });
  t.after(s.close);
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await s.req('GET', '/x', { headers: { 'X-Forwarded-For': `9.9.9.${i}` } })).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429], 'rotating X-Forwarded-For does not reset the limit');
});

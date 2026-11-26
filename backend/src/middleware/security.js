const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { getConfig } = require('../config/env');
const { ipKey } = require('../utils/ip');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ── Runs BEFORE body parsing ─────────────────────────────────────────
function securityPre(app) {
  const cfg = getConfig();

  // Exact number of reverse-proxy hops. `true` would let any client spoof
  // X-Forwarded-For and walk around every IP-based limiter.
  app.set('trust proxy', cfg.trustProxy);
  app.disable('x-powered-by');

  // This service only returns JSON, so the CSP is "nothing is allowed".
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  }));

  const allowed = new Set(cfg.clientOrigins);
  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // non-browser clients / same-origin; unsafe methods are checked by csrfGuard
      if (allowed.has(origin)) return cb(null, true);
      return cb(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  }));
}

// ── Runs AFTER body parsing + cookies ────────────────────────────────
// (express-mongo-sanitize and hpp only see req.body if it already exists.)
function securityPost(app) {
  app.use(mongoSanitize({ replaceWith: '_' }));
  app.use(hpp());
  app.use(csrfGuard);
}

// CSRF defence for cookie-authenticated requests:
//  1. Unsafe methods must come from an allow-listed Origin (browsers always
//     send Origin on cross-origin and on same-origin POST/PUT/PATCH/DELETE).
//  2. A request carrying the session cookie but NO Origin is refused.
//  3. Request bodies must be application/json (HTML forms can only send
//     urlencoded / multipart / text, so they can never reach a handler).
function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cfg = getConfig();
  const origin = req.get('origin');
  if (origin) {
    if (!cfg.clientOrigins.includes(origin)) return res.status(403).json({ error: 'Cross-origin request blocked' });
  } else if (req.cookies && req.cookies.token) {
    return res.status(403).json({ error: 'Cross-origin request blocked' });
  }
  const hasBody = Number(req.get('content-length') || 0) > 0 || req.get('transfer-encoding');
  if (hasBody && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
}

const limiterBase = { standardHeaders: true, legacyHeaders: false, keyGenerator: ipKey, message: { error: 'Too many requests - please slow down and try again shortly.' } };

const generalLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, limit: 400 });
const writeLimiter = rateLimit({
  ...limiterBase, windowMs: 15 * 60 * 1000, limit: 300,
  skip: (req) => SAFE_METHODS.has(req.method),
});
// Per IP; only failed attempts count.
const authLimiter = rateLimit({
  ...limiterBase, windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true,
  message: { error: 'Too many attempts - please wait a few minutes and try again.' },
});
// Per target account (e-mail), independent of the caller's IP.
const emailKey = (req) => `e:${String(req.body?.email || '').toLowerCase().trim().slice(0, 254)}`;
const perEmailLimiter = rateLimit({
  ...limiterBase, windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, keyGenerator: emailKey,
  message: { error: 'Too many attempts - please wait a few minutes and try again.' },
});
// Very low-volume, abuse-prone actions (e-mail sending, password checks).
const makeSensitiveLimiter = (limit, windowMs = 60 * 60 * 1000) => rateLimit({
  ...limiterBase, windowMs, limit,
  keyGenerator: (req) => `u:${req.user ? String(req.user._id) : 'anon'}`,
  message: { error: 'Too many requests for this action - try again later.' },
});
const ipSensitiveLimiter = (limit, windowMs = 60 * 60 * 1000) => rateLimit({ ...limiterBase, windowMs, limit });

module.exports = {
  securityPre, securityPost, csrfGuard,
  generalLimiter, writeLimiter, authLimiter, perEmailLimiter, makeSensitiveLimiter, ipSensitiveLimiter,
};

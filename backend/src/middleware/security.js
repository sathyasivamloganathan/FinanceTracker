const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

// ─── Input size limits ────────────────────────────────────────────────
// Enforced in server.js via express.json({ limit: '200kb' }).
// No single user action requires more than a few KB. This prevents
// request-body-based memory exhaustion.

// ─── CORS ────────────────────────────────────────────────────────────
function applySecurity(app) {
  app.set('trust proxy', true);

  // Helmet: secure HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Next.js inline scripts
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      noSniff: true,
      frameguard: { action: 'deny' }, // clickjacking protection
      xssFilter: true,
    })
  );

  const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow server-to-server (no origin) and whitelisted origins only
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400, // preflight cache 24h
    })
  );

  // Strip MongoDB operator injection ($, .) from all user input
  app.use(mongoSanitize({
    replaceWith: '_',
    onSanitizeError: (req, key) => {
      console.warn(`[security] MongoSanitize blocked key "${key}" from ${req.ip}`);
    },
  }));

  // Prevent HTTP parameter pollution
  app.use(hpp());
}

// ─── Rate limiters ───────────────────────────────────────────────────
function ipKey(req) {
  return (req.ip || 'unknown').replace(/:\d+$/, '');
}

// Global: 300 requests / 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: 'Too many requests — please slow down.' },
});

// Auth routes: 15 attempts / 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: 'Too many login attempts — try again in 15 minutes.' },
  skipSuccessfulRequests: true, // only count failures toward the limit
});

// Write operations: 100 mutations / 15 min per IP
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: 'Too many write requests — please slow down.' },
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
});

module.exports = { applySecurity, generalLimiter, authLimiter, writeLimiter };

const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

// Security posture summary (see README for the full list):
// - helmet: sets safe HTTP response headers (CSP, no-sniff, frameguard, HSTS in prod, etc.)
// - cors: only the origins listed in CLIENT_ORIGINS may call this API with credentials
// - express-mongo-sanitize: strips "$" / "." operators from req.body/query/params
//   so user input can't be used to inject MongoDB query operators
// - hpp: prevents HTTP parameter pollution (duplicate query keys overriding each other)
// - rate limiting: throttles brute-force / scraping attempts, tighter on auth routes
// - passwords are hashed with bcrypt (see routes/auth.routes.js), never stored in plain text
// - JWT is stored in an httpOnly, sameSite cookie — not accessible to page JavaScript,
//   which blocks the most common XSS-based token-theft path
//
// What this does NOT cover (you must add these yourself in production):
// - TLS/HTTPS termination (use a reverse proxy like nginx/Caddy or your host's built-in TLS)
// - A managed secrets store instead of a plain .env file
// - DDoS protection at the network edge (Cloudflare, AWS Shield, etc.)
// - Regular `npm audit` / dependency updates
// No configuration makes an application "unhackable" — this gives you a solid,
// standard baseline, not a guarantee.

function applySecurity(app) {
  app.set("trust proxy", true);

  app.use(
    helmet({
      contentSecurityPolicy: false, // enable + configure this once you know your exact frontend origin/CDN needs
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim());

  app.use(
    cors({
      origin(origin, callback) {
        console.log("CLIENT_ORIGINS ENV:", process.env.CLIENT_ORIGINS);
        console.log("REQUEST ORIGIN:", origin);

        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );

  app.use(mongoSanitize());
  app.use(hpp());
}

// General limiter for all API traffic
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    return req.ip.replace(/^::ffff:/, "").split(":")[0];
  },

  message: { error: "Too many requests, please slow down." },
});

// Tighter limiter specifically for login/register to blunt brute-force / credential stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    return req.ip.replace(/^::ffff:/, "").split(":")[0];
  },

  message: { error: "Too many attempts, please try again later." },
});

module.exports = { applySecurity, generalLimiter, authLimiter };

// Central, validated configuration. The server refuses to start with a weak
// or missing secret instead of failing later with confusing 500s.
const PLACEHOLDER = /^REPLACE_WITH/i;

function parseList(v) {
  return String(v || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const prod = nodeEnv === 'production';
  const errors = [];

  const jwtSecret = env.JWT_SECRET || '';
  if (!jwtSecret || PLACEHOLDER.test(jwtSecret) || jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be set to a random string of at least 32 characters');
  }
  if (!env.MONGODB_URI || PLACEHOLDER.test(env.MONGODB_URI)) {
    errors.push('MONGODB_URI is not set');
  }

  const clientOrigins = parseList(env.CLIENT_ORIGINS || (prod ? '' : 'http://localhost:3000'));
  if (prod && clientOrigins.length === 0) errors.push('CLIENT_ORIGINS must list your frontend origin(s) in production');
  for (const o of clientOrigins) {
    try { const u = new URL(o); if (u.origin !== o) errors.push(`CLIENT_ORIGINS entry "${o}" must be an origin only (no path / trailing slash)`); }
    catch { errors.push(`CLIENT_ORIGINS entry "${o}" is not a valid URL`); }
  }

  const frontendUrl = (env.FRONTEND_URL || (prod ? '' : 'http://localhost:3000')).replace(/\/+$/, '');
  if (prod && !frontendUrl) errors.push('FRONTEND_URL must be set in production');

  const sameSite = (env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSite)) errors.push('COOKIE_SAMESITE must be lax, strict or none');
  if (sameSite === 'none' && !prod) errors.push('COOKIE_SAMESITE=none requires HTTPS (NODE_ENV=production)');

  // Number of reverse proxies in front of the app (Azure App Service = 1).
  // NEVER `true` — that lets any client spoof X-Forwarded-For.
  let trustProxy = env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '' ? Number(env.TRUST_PROXY) : (prod ? 1 : 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) {
    errors.push('TRUST_PROXY must be an integer hop count between 0 and 5');
    trustProxy = 0;
  }

  if (errors.length) {
    const err = new Error('Invalid configuration:\n - ' + errors.join('\n - '));
    err.isConfigError = true;
    throw err;
  }

  const googleEnabled = !!env.GOOGLE_CLIENT_ID && !PLACEHOLDER.test(env.GOOGLE_CLIENT_ID)
    && !!env.GOOGLE_CLIENT_SECRET && !PLACEHOLDER.test(env.GOOGLE_CLIENT_SECRET)
    && !!env.GOOGLE_CALLBACK_URL && !PLACEHOLDER.test(env.GOOGLE_CALLBACK_URL);

  const emailConfigured = !!env.EMAIL_USER && !PLACEHOLDER.test(env.EMAIL_USER) && !!env.EMAIL_PASS && !PLACEHOLDER.test(env.EMAIL_PASS);

  return {
    nodeEnv, prod, jwtSecret,
    port: Number(env.PORT) || 4000,
    clientOrigins, frontendUrl,
    cookie: {
      sameSite,
      secure: prod || env.COOKIE_SECURE === 'true',
      maxAgeMs: Number(env.COOKIE_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000,
    },
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    trustProxy,
    googleEnabled, emailConfigured,
    runJobs: env.RUN_JOBS !== 'false',
  };
}

let cached;
function getConfig() {
  if (!cached) cached = loadConfig();
  return cached;
}
function resetConfigForTests() { cached = undefined; }

module.exports = { loadConfig, getConfig, resetConfigForTests };

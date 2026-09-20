// ── 404 catch-all ────────────────────────────────────────────────────
function notFound(req, res, next) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

// ── Centralised error handler ─────────────────────────────────────────
// Express calls this when next(err) is called anywhere in a route.
// Never leak stack traces or internal error messages to the client in
// production — they disclose implementation details useful for attackers.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;

  // Log the full error server-side — always
  if (status >= 500) {
    console.error('[error]', err.stack || err.message);
  } else {
    console.warn('[warn]', err.message);
  }

  // Mongoose validation errors — safe to surface (they describe user input problems)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message).join('; ');
    return res.status(400).json({ error: messages });
  }

  // Mongoose duplicate key — safe to surface
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ error: `${field} already exists` });
  }

  // CORS rejections surface as plain Error from cors() — bubble up as 403
  if (err.message && err.message.includes('not allowed by CORS')) {
    return res.status(403).json({ error: 'Cross-origin request blocked' });
  }

  // In production: generic message — don't expose internals
  const message =
    process.env.NODE_ENV === 'production' && status >= 500
      ? 'An internal error occurred. Please try again later.'
      : err.message || 'Unknown error';

  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };

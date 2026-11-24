function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Centralised error handler. Messages are only exposed to the client when we
// raised them deliberately (HttpError / validation); everything else is a
// generic message so internals never leak.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);

  // Body-parser errors
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in request body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });

  if (err.name === 'HttpError') {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err.name === 'ValidationError' && err.errors) {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join('; ') });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid value for ${err.path || 'field'}` });
  }
  if (err.name === 'VersionError' || err.name === 'ParallelSaveError') {
    return res.status(409).json({ error: 'Your data changed in another tab or session. Please retry.' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const msg = field === 'email' ? 'An account with this email already exists' : 'Duplicate value';
    return res.status(409).json({ error: msg });
  }
  if (err.message && err.message.includes('not allowed by CORS')) {
    return res.status(403).json({ error: 'Cross-origin request blocked' });
  }

  const status = Number(err.status || err.statusCode) || 500;
  if (status >= 500) console.error('[error]', req.method, req.originalUrl.split('?')[0], err.stack || err.message);
  else console.warn('[warn]', status, err.message);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status >= 500 ? 'An internal error occurred. Please try again later.' : 'Request could not be processed',
  });
}

module.exports = { notFound, errorHandler };

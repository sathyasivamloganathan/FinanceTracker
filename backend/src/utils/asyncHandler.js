// Wraps an async route handler so thrown errors / rejected promises go to the
// Express error middleware instead of crashing the process.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// For handlers that read-modify-write the user document. If another writer
// (a second tab, a cron job) changed the document between our read and our
// save, Mongoose throws VersionError; we reload a fresh copy and re-run the
// handler (it must only respond AFTER saving) instead of losing the update.
function mutating(fn, attempts = 4) {
  return async function (req, res, next) {
    try {
      for (let i = 1; ; i++) {
        try {
          return await fn(req, res, next);
        } catch (err) {
          const isVersion = err && (err.name === 'VersionError' || err.name === 'ParallelSaveError');
          if (!isVersion || i >= attempts || res.headersSent) throw err;
          const User = require('../models/User');
          const fresh = await User.findById(req.user._id);
          if (!fresh) throw err;
          req.user = fresh;
        }
      }
    } catch (err) {
      next(err);
    }
  };
}

module.exports = asyncHandler;
module.exports.mutating = mutating;

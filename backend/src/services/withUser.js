const User = require('../models/User');

// Load a FRESH copy of one user, run fn(user), save if anything changed, and
// retry on a concurrent-write conflict. Used by scheduled jobs so a job never
// overwrites edits the user made while it was running.
async function withUser(userId, fn, attempts = 4) {
  for (let i = 1; ; i++) {
    const user = await User.findById(userId);
    if (!user) return undefined;
    try {
      const result = await fn(user);
      if (user.isModified()) await user.save();
      return result;
    } catch (err) {
      const conflict = err && (err.name === 'VersionError' || err.name === 'ParallelSaveError');
      if (!conflict || i >= attempts) throw err;
    }
  }
}

module.exports = { withUser };

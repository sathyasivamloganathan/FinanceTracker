// Wraps an async route handler so thrown errors / rejected promises
// go to Express's error-handling middleware instead of crashing the process.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

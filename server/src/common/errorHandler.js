// Express 5 forwards errors thrown in async handlers here automatically.
function errorHandler(err, req, res, next) {
  // A malformed id in the URL (Postgres "invalid input syntax") is the caller's mistake, not ours
  if (!err.status && err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid id' });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;

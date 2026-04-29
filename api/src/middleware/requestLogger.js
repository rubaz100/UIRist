'use strict';
const log = require('../logger');

// Skips noisy paths that get hit on every healthcheck poll.
const SKIP_PATHS = new Set(['/health']);

function requestLogger(req, res, next) {
  if (!SKIP_PATHS.has(req.path)) {
    log.info('Request', { method: req.method, path: req.path });
  }
  next();
}

module.exports = requestLogger;

'use strict';
const log = require('../logger');
const configManager = require('../configManager');

// API key is read dynamically: env var takes precedence over the persisted
// config. This way, updating the key via PUT /api/config takes effect
// immediately for subsequent requests — no server restart needed.
function getActiveApiKey() {
  return process.env.RIST_API_KEY || configManager.getConfig().ristApiKey || '';
}

function auth(req, res, next) {
  const apiKey = getActiveApiKey();
  if (!apiKey) return next();
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== apiKey) {
    log.warn('Unauthorized request', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized – set X-API-Key header' });
  }
  next();
}

module.exports = { auth, getActiveApiKey };

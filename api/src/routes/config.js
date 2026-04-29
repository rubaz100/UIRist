'use strict';
const express = require('express');
const log = require('../logger');
const { auth } = require('../middleware/auth');
const configManager = require('../configManager');

const router = express.Router();

const PASSWORD_MIN = 4;

router.get('/api/config', auth, (req, res) => {
  const status = configManager.getStatus();
  res.json({
    config: configManager.getConfig(),
    error: status.error,
    configFile: status.configFile,
  });
});

router.put('/api/config', auth, (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Body must be an object of config updates' });
  }
  try {
    const { config } = configManager.saveConfig(updates);
    res.json({ config, error: null });
  } catch (err) {
    log.error('Config save endpoint error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/config/export', auth, (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters` });
  }
  try {
    const envelope = configManager.encryptConfig(password);
    res.json(envelope);
  } catch (err) {
    log.error('Config export error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/config/import', auth, (req, res) => {
  const { password, envelope } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }
  if (!envelope || typeof envelope !== 'object') {
    return res.status(400).json({ error: 'envelope is required' });
  }
  try {
    const decrypted = configManager.decryptConfig(envelope, password);
    const { config } = configManager.saveConfig(decrypted);
    res.json({ config, error: null });
  } catch (err) {
    log.warn('Config import failed', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

'use strict';
const express = require('express');
const { getBinaryStatus } = require('../receiverManager');

const router = express.Router();

// Public — used by Docker healthcheck. No auth.
router.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', ristreceiver: getBinaryStatus() });
});

module.exports = router;

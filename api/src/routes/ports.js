'use strict';
const express = require('express');
const { auth } = require('../middleware/auth');
const { isUdpPortAvailable, RESERVED_PORTS } = require('../portChecker');
const { getUsedPorts } = require('../receiverManager');
const { validatePortNumber } = require('../validators/port');

const router = express.Router();

router.get('/api/ports/check', auth, async (req, res) => {
  const { valid, error, port } = validatePortNumber(req.query.port);
  if (!valid) return res.status(400).json({ error });

  const reserved = RESERVED_PORTS.has(port);
  const usedByReceiver = getUsedPorts().includes(port);
  const available = !reserved && !usedByReceiver && (await isUdpPortAvailable(port));
  res.json({ port, available, reserved, usedByReceiver });
});

router.get('/api/ports/used', auth, (req, res) => {
  res.json({
    receiverPorts: getUsedPorts(),
    reservedPorts: Array.from(RESERVED_PORTS),
  });
});

module.exports = router;

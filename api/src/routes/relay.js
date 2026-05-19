'use strict';
const express = require('express');
const log = require('../logger');
const { auth } = require('../middleware/auth');
const { RESERVED_PORTS } = require('../portChecker');
const { getReceiver, getUsedPorts, startReceiverRelay, stopReceiverRelay } = require('../receiverManager');
const { getRelayLogs } = require('../relayManager');
const { validateSrtPort, validatePassphrase } = require('../validators/relay');

const router = express.Router();

router.get('/api/receivers/:id/relay', auth, (req, res) => {
  const rec = getReceiver(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  if (!rec.relay) return res.status(404).json({ error: 'No relay configured for this receiver' });
  res.json(rec.relay);
});

router.get('/api/receivers/:id/relay/logs', auth, (req, res) => {
  const logs = getRelayLogs(req.params.id);
  if (logs === null) return res.status(404).json({ error: 'No relay running for this receiver' });
  res.json({ logs });
});

router.post('/api/receivers/:id/relay', auth, async (req, res) => {
  const rec = getReceiver(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });

  const { srtPort, passphrase } = req.body || {};

  const portError = validateSrtPort(srtPort);
  if (portError) return res.status(400).json({ error: portError });
  if (RESERVED_PORTS.has(srtPort)) {
    return res.status(400).json({ error: `Port ${srtPort} is reserved` });
  }
  if (getUsedPorts().includes(srtPort)) {
    return res.status(400).json({ error: `Port ${srtPort} is already used by a receiver` });
  }

  const passError = validatePassphrase(passphrase);
  if (passError) return res.status(400).json({ error: passError });

  try {
    const relay = await startReceiverRelay(req.params.id, srtPort, passphrase?.trim());
    res.status(201).json(relay);
  } catch (err) {
    log.error('Failed to start relay', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/receivers/:id/relay', auth, (req, res) => {
  const rec = getReceiver(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  const ok = stopReceiverRelay(req.params.id);
  if (!ok) return res.status(404).json({ error: 'No relay found for this receiver' });
  res.json({ success: true });
});

module.exports = router;

'use strict';
const express = require('express');
const log = require('../logger');
const { auth } = require('../middleware/auth');
const { createReceiverLimiter } = require('../middleware/rateLimits');
const { RESERVED_PORTS } = require('../portChecker');
const { startReceiver, stopReceiver, listReceivers, getReceiver, receivers } = require('../receiverManager');
const { validateCreatePayload, validateUpdatePayload } = require('../validators/receiver');

const router = express.Router();

// ── List / get ────────────────────────────────────────────────────────
router.get('/api/receivers', auth, (req, res) => {
  res.json(listReceivers());
});

router.get('/api/receivers/:id', auth, (req, res) => {
  const rec = getReceiver(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json(rec);
});

router.get('/api/receivers/:id/logs', auth, (req, res) => {
  const rec = receivers.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ logs: rec.logs });
});

// ── Create ────────────────────────────────────────────────────────────
router.post('/api/receivers', auth, createReceiverLimiter, async (req, res) => {
  const body = req.body || {};

  const error = validateCreatePayload(body);
  if (error) return res.status(400).json({ error });
  if (RESERVED_PORTS.has(body.listenPort)) {
    return res.status(400).json({ error: `Port ${body.listenPort} is reserved and cannot be used` });
  }

  try {
    const rec = await startReceiver({
      name: body.name?.trim(),
      listenPort: body.listenPort,
      outputUrl: body.outputUrl.trim(),
      secret: body.secret?.trim(),
    });
    const { _proc, ...pub } = rec;
    res.status(201).json(pub);
  } catch (err) {
    log.error('Failed to start receiver', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Update (name | secret | outputUrl). Port stays fixed while running. ──
router.put('/api/receivers/:id', auth, async (req, res) => {
  const rec = getReceiver(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });

  const body = req.body || {};
  const error = validateUpdatePayload(body);
  if (error) return res.status(400).json({ error });

  const updates = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.secret !== undefined) updates.secret = body.secret.trim();
  if (body.outputUrl !== undefined) updates.outputUrl = body.outputUrl.trim();

  if (Object.keys(updates).length === 0) {
    const { _proc, ...pub } = rec;
    return res.json(pub);
  }

  try {
    // secret/outputUrl are arguments to the spawned ristreceiver process,
    // so we must restart the process for those changes to take effect.
    // Name is just metadata and can be updated in-place.
    const needsRestart = updates.secret || updates.outputUrl;

    if (needsRestart) {
      stopReceiver(req.params.id);
      const newRec = await startReceiver({
        id: rec.id,
        name: updates.name || rec.name,
        listenPort: rec.listenPort,
        secret: updates.secret || rec.secret,
        outputUrl: updates.outputUrl || rec.outputUrl,
        createdAt: rec.createdAt,
      });
      const { _proc, ...pub } = newRec;
      return res.json(pub);
    }

    rec.name = updates.name;
    const { _proc, ...pub } = rec;
    res.json(pub);
  } catch (err) {
    log.error('Failed to update receiver', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Delete ────────────────────────────────────────────────────────────
router.delete('/api/receivers/:id', auth, (req, res) => {
  const ok = stopReceiver(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ success: true });
});

module.exports = router;

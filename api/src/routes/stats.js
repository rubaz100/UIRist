'use strict';
const express = require('express');
const { auth } = require('../middleware/auth');
const { getAllFlows, getReceiverFlows, receivers } = require('../receiverManager');

const router = express.Router();

router.get('/api/stats', auth, (req, res) => {
  res.json({ flows: getAllFlows() });
});

router.get('/api/receivers/:id/stats', auth, (req, res) => {
  const rec = receivers.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ flows: getReceiverFlows(req.params.id) });
});

module.exports = router;

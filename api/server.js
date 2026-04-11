'use strict';
const express = require('express');
const { startReceiver, stopReceiver, listReceivers, getReceiver, getReceiverFlows, getAllFlows, getBinaryStatus, receivers } = require('./src/receiverManager');

const app = express();
const PORT = process.env.RIST_API_PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    ristreceiver: getBinaryStatus(),
  });
});

// ── Receivers ─────────────────────────────────────────────────────────────────
// List all receivers
app.get('/api/receivers', (req, res) => {
  res.json(listReceivers());
});

// Get single receiver
app.get('/api/receivers/:id', (req, res) => {
  const rec = getReceiver(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json(rec);
});

// Start a new receiver
app.post('/api/receivers', (req, res) => {
  const { name, listenPort, outputUrl } = req.body || {};

  if (!listenPort || !outputUrl) {
    return res.status(400).json({ error: 'listenPort and outputUrl are required' });
  }
  if (typeof listenPort !== 'number' || listenPort < 1 || listenPort > 65535) {
    return res.status(400).json({ error: 'listenPort must be a number between 1 and 65535' });
  }

  try {
    const rec = startReceiver({ name, listenPort, outputUrl });
    res.status(201).json(rec);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a receiver
app.delete('/api/receivers/:id', (req, res) => {
  const ok = stopReceiver(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ success: true });
});

// Get logs for a receiver
app.get('/api/receivers/:id/logs', (req, res) => {
  const rec = receivers.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ logs: rec.logs });
});

// ── Stats / Flows ─────────────────────────────────────────────────────────────
// Aggregated flows from all running receivers (JSON)
app.get('/api/stats', (req, res) => {
  res.json({ flows: getAllFlows() });
});

// Flows for a single receiver
app.get('/api/receivers/:id/stats', (req, res) => {
  const rec = receivers.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ flows: getReceiverFlows(req.params.id) });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const bin = getBinaryStatus();
  console.log(`\nUIRist API Server running on http://localhost:${PORT}`);
  console.log(`ristreceiver: ${bin.available ? bin.path : 'NOT FOUND – install with: brew install librist'}`);
  console.log('\nEndpoints:');
  console.log('  GET  /health');
  console.log('  GET  /api/receivers');
  console.log('  POST /api/receivers        { name, listenPort, outputUrl }');
  console.log('  DELETE /api/receivers/:id');
  console.log('  GET  /api/stats            (aggregated flows JSON)');
  console.log('  GET  /api/receivers/:id/stats');
  console.log('  GET  /api/receivers/:id/logs\n');
});

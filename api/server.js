'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const log = require('./src/logger');
const { isUdpPortAvailable, RESERVED_PORTS, RECEIVER_PORT_MIN, RECEIVER_PORT_MAX } = require('./src/portChecker');
const {
  startReceiver, stopReceiver, listReceivers, getReceiver,
  getReceiverFlows, getAllFlows, getBinaryStatus, getUsedPorts, receivers,
} = require('./src/receiverManager');

const app = express();
const PORT = process.env.RIST_API_PORT || 3001;
const API_KEY = process.env.RIST_API_KEY || '';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Request logging
app.use((req, res, next) => {
  if (req.path !== '/health') {
    log.info('Request', { method: req.method, path: req.path });
  }
  next();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== API_KEY) {
    log.warn('Unauthorized request', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized – set X-API-Key header' });
  }
  next();
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
const createLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many receiver creation requests, please wait.' },
});

// ── Input validation ──────────────────────────────────────────────────────────
function validateOutputUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return 'outputUrl is required';
  if (!/^(udp|rtp|srt|rtmp|file):\/\//i.test(url)) {
    return 'outputUrl must use udp://, rtp://, srt://, rtmp://, or file:// scheme';
  }
  if (/[;&|`$(){}[\]\\<>'"!]/.test(url)) return 'outputUrl contains invalid characters';
  return null;
}

// ── Health (no auth) ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', ristreceiver: getBinaryStatus() });
});

// ── Port availability ─────────────────────────────────────────────────────────
app.get('/api/ports/check', auth, async (req, res) => {
  const port = parseInt(req.query.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    return res.status(400).json({ error: 'Invalid port number' });
  }
  const reserved = RESERVED_PORTS.has(port);
  const usedByReceiver = getUsedPorts().includes(port);
  const outOfRange = port < RECEIVER_PORT_MIN || port > RECEIVER_PORT_MAX;
  const available = !reserved && !usedByReceiver && !outOfRange && await isUdpPortAvailable(port);
  res.json({ port, available, reserved, usedByReceiver, outOfRange, allowedRange: { min: RECEIVER_PORT_MIN, max: RECEIVER_PORT_MAX } });
});

app.get('/api/ports/used', auth, (req, res) => {
  res.json({
    receiverPorts: getUsedPorts(),
    reservedPorts: Array.from(RESERVED_PORTS),
  });
});

// ── Receivers ─────────────────────────────────────────────────────────────────
app.get('/api/receivers', auth, (req, res) => {
  res.json(listReceivers());
});

app.get('/api/receivers/:id', auth, (req, res) => {
  const rec = getReceiver(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json(rec);
});

app.post('/api/receivers', auth, createLimiter, async (req, res) => {
  const { name, listenPort, outputUrl } = req.body || {};

  if (!listenPort || typeof listenPort !== 'number' || listenPort < 1 || listenPort > 65535) {
    return res.status(400).json({ error: 'listenPort must be a number between 1 and 65535' });
  }
  if (RESERVED_PORTS.has(listenPort)) {
    return res.status(400).json({ error: `Port ${listenPort} is reserved and cannot be used` });
  }
  const urlError = validateOutputUrl(outputUrl);
  if (urlError) return res.status(400).json({ error: urlError });
  if (name !== undefined && (typeof name !== 'string' || name.length > 64)) {
    return res.status(400).json({ error: 'name must be a string of max 64 characters' });
  }

  try {
    const rec = await startReceiver({ name: name?.trim(), listenPort, outputUrl: outputUrl.trim() });
    const { _proc, ...pub } = rec;
    res.status(201).json(pub);
  } catch (err) {
    log.error('Failed to start receiver', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/receivers/:id', auth, (req, res) => {
  const ok = stopReceiver(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ success: true });
});

app.get('/api/receivers/:id/logs', auth, (req, res) => {
  const rec = receivers.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ logs: rec.logs });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', auth, (req, res) => {
  res.json({ flows: getAllFlows() });
});

app.get('/api/receivers/:id/stats', auth, (req, res) => {
  const rec = receivers.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Receiver not found' });
  res.json({ flows: getReceiverFlows(req.params.id) });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const bin = getBinaryStatus();
  log.info('UIRist API Server started', {
    port: PORT,
    ristreceiver: bin.available ? bin.path : 'NOT FOUND',
    auth: API_KEY ? 'enabled' : 'disabled',
    cors: allowedOrigin,
  });
});

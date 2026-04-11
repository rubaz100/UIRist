'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { startReceiver, stopReceiver, listReceivers, getReceiver, getReceiverFlows, getAllFlows, getBinaryStatus, receivers } = require('./src/receiverManager');

const app = express();
const PORT = process.env.RIST_API_PORT || 3001;
const API_KEY = process.env.RIST_API_KEY || '';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// CORS — restrict to configured origin in prod, open in dev
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  if (!API_KEY) return next(); // no key configured → open (dev mode)
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== API_KEY) {
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
  const allowed = /^(udp|rtp|srt|rtmp|file):\/\//i;
  if (!allowed.test(url)) return 'outputUrl must use udp://, rtp://, srt://, rtmp://, or file:// scheme';
  // No shell metacharacters
  if (/[;&|`$(){}[\]\\<>'"!]/.test(url)) return 'outputUrl contains invalid characters';
  return null;
}

// ── Health (no auth required) ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    ristreceiver: getBinaryStatus(),
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

app.post('/api/receivers', auth, createLimiter, (req, res) => {
  const { name, listenPort, outputUrl } = req.body || {};

  if (!listenPort || typeof listenPort !== 'number' || listenPort < 1 || listenPort > 65535) {
    return res.status(400).json({ error: 'listenPort must be a number between 1 and 65535' });
  }

  const urlError = validateOutputUrl(outputUrl);
  if (urlError) return res.status(400).json({ error: urlError });

  if (name !== undefined && (typeof name !== 'string' || name.length > 64)) {
    return res.status(400).json({ error: 'name must be a string of max 64 characters' });
  }

  try {
    const rec = startReceiver({ name: name?.trim(), listenPort, outputUrl: outputUrl.trim() });
    const { _proc, ...pub } = rec;
    res.status(201).json(pub);
  } catch (err) {
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
  console.log(`\nUIRist API Server running on http://localhost:${PORT}`);
  console.log(`ristreceiver: ${bin.available ? bin.path : 'NOT FOUND – install with: brew install librist'}`);
  console.log(`Auth: ${API_KEY ? 'enabled (X-API-Key)' : 'disabled (set RIST_API_KEY to enable)'}`);
  console.log(`CORS: ${allowedOrigin}\n`);
});

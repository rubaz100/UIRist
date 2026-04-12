'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const log = require('./src/logger');
const { isUdpPortAvailable, RESERVED_PORTS, RECEIVER_PORT_MIN, RECEIVER_PORT_MAX } = require('./src/portChecker');
const { openPort } = require('./src/portManager');
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
  if (!/^(udp|rtp):\/\//i.test(url)) {
    return 'outputUrl must use udp:// or rtp:// scheme (ristreceiver only supports UDP/RTP output)';
  }
  if (/[;&|`$(){}[\]\\<>'"!]/.test(url)) return 'outputUrl contains invalid characters';
  return null;
}

// ── Health (no auth) ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', ristreceiver: getBinaryStatus() });
});

// ── IP lookup (ISP / provider resolution) ─────────────────────────────────────
const ipLookupCache = new Map(); // ip → { data, cachedAt }
const IP_CACHE_TTL = 3_600_000; // 1 hour

function isPrivateIp(ip) {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fd[0-9a-f]{2}:)/i.test(ip);
}

app.get('/api/ip-lookup/:ip', auth, async (req, res) => {
  const { ip } = req.params;
  if (!/^[\d.:a-fA-F]+$/.test(ip)) return res.status(400).json({ error: 'Invalid IP' });

  if (isPrivateIp(ip)) return res.json({ ip, isp: 'Private / Local', country: null, city: null });

  const cached = ipLookupCache.get(ip);
  if (cached && Date.now() - cached.cachedAt < IP_CACHE_TTL) return res.json(cached.data);

  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,isp,org,country,city`, {
      signal: AbortSignal.timeout(4000),
    });
    const d = await r.json();
    const data = { ip, isp: d.isp || d.org || null, country: d.country || null, city: d.city || null };
    ipLookupCache.set(ip, { data, cachedAt: Date.now() });
    res.json(data);
  } catch {
    res.json({ ip, isp: null, country: null, city: null });
  }
});

// ── Port availability ─────────────────────────────────────────────────────────
app.get('/api/ports/check', auth, async (req, res) => {
  const port = parseInt(req.query.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    return res.status(400).json({ error: 'Invalid port number' });
  }
  const reserved = RESERVED_PORTS.has(port);
  const usedByReceiver = getUsedPorts().includes(port);
  const available = !reserved && !usedByReceiver && await isUdpPortAvailable(port);
  res.json({ port, available, reserved, usedByReceiver });
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
  openPort(PORT, 'tcp'); // open API port in iptables automatically
});

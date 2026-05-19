'use strict';
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { startSocketServer, stopSocketServer, getPeerIps, getPeerIpMap } = require('./metricsServer');
const ispLookup = require('./ispLookup');
const { openPort, closePort } = require('./portManager');
const { saveState, loadState, normalizeRelayConfig } = require('./stateManager');
const {
  startRelay: startLiveRelay,
  stopRelay: stopLiveRelay,
  getRelay,
} = require('./relayManager');
const { isUdpPortAvailable } = require('./portChecker');
const log = require('./logger');

function findBinary() {
  const candidates = [
    process.env.RISTRECEIVER_BIN,
    '/opt/homebrew/bin/ristreceiver',
    '/usr/local/bin/ristreceiver',
    '/usr/bin/ristreceiver',
    'ristreceiver',
  ].filter(Boolean);

  for (const bin of candidates) {
    try {
      require('child_process').execFileSync(bin, ['--version'], { stdio: 'pipe' });
      return bin;
    } catch (e) {
      if (e.status !== undefined || e.code !== 'ENOENT') return bin;
    }
  }
  return null;
}

const BINARY = findBinary();
const receivers = new Map();

function persistState() {
  saveState(receivers);
}

function generateSecret() {
  // 16 URL-safe random bytes → 22 base64url chars, no special chars
  return crypto.randomBytes(16).toString('base64url');
}

async function startReceiver({ name, listenPort, outputUrl, secret, id: existingId, createdAt: existingCreatedAt, relay } = {}) {
  if (!BINARY) {
    throw new Error('ristreceiver binary not found. Install librist: brew install librist');
  }

  // Port conflict detection
  const portFree = await isUdpPortAvailable(listenPort);
  if (!portFree) {
    throw new Error(`UDP port ${listenPort} is already in use`);
  }

  const id = existingId || uuidv4();
  // Default name: short human-readable ID, not port-based
  const recName = name || `stream-${id.slice(0, 8)}`;
  const recSecret = secret || generateSecret();
  const socketPath = `/tmp/rist-metrics-${id}.sock`;
  // Append PSK secret to RIST URL — ristreceiver enforces authentication
  const inputUrl = `rist://@0.0.0.0:${listenPort}?secret=${encodeURIComponent(recSecret)}`;

  startSocketServer(socketPath, id, recName);

  const args = [
    '-i', inputUrl,
    '-o', outputUrl,
    '-S', '2000',
    '-M',
    '--metrics-unix', socketPath,
  ];

  const proc = spawn(BINARY, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const record = {
    id,
    name: recName,
    secret: recSecret,
    listenPort,
    outputUrl,
    socketPath,
    status: 'starting',
    pid: proc.pid,
    createdAt: existingCreatedAt || new Date().toISOString(),
    logs: [],
    lastJsonStats: null, // most recent receiver-stats JSON line — survives log buffer flood
  };
  const relayConfig = normalizeRelayConfig(relay);
  if (relayConfig) record.relay = relayConfig;

  const processChunk = (chunk) => {
    // Split chunk into individual lines — data events can contain multiple lines
    const lines = chunk.toString().split('\n');
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line) continue;

      // Rolling log buffer
      record.logs.push(line);
      if (record.logs.length > 500) record.logs.shift();

      // Always keep the most recent JSON stats line outside the rolling buffer
      // so a flood of "Too many old packets" messages can't push it out
      const jsonIdx = line.indexOf('{"receiver-stats"');
      if (jsonIdx !== -1) record.lastJsonStats = line.slice(jsonIdx);
    }
  };

  proc.stdout.on('data', processChunk);
  proc.stderr.on('data', processChunk);

  proc.on('spawn', () => {
    record.status = 'running';
    log.info('Receiver started', { id, name: recName, port: listenPort });
    openPort(listenPort, 'udp');                            // RIST input
    persistState();
  });
  proc.on('error', (err) => {
    record.status = 'error';
    record.error = err.message;
    log.error('Receiver process error', { id, name: recName, error: err.message });
    stopSocketServer(socketPath);
    persistState();
  });
  proc.on('exit', (code) => {
    record.status = code === 0 ? 'stopped' : 'error';
    record.pid = null;
    log.info('Receiver exited', { id, name: recName, code });
    stopSocketServer(socketPath);
    persistState();
  });

  setTimeout(() => {
    if (record.status === 'starting') {
      record.status = 'running';
      persistState();
    }
  }, 1500);

  record._proc = proc;
  receivers.set(id, record);
  persistState();
  return record;
}

async function startReceiverRelay(receiverId, srtPort, passphrase) {
  const rec = receivers.get(receiverId);
  if (!rec) throw new Error('Receiver not found');

  const relay = await startLiveRelay(receiverId, rec.outputUrl, srtPort, passphrase);
  const relayConfig = normalizeRelayConfig(relay);
  if (relayConfig) {
    rec.relay = relayConfig;
    persistState();
  }
  return relay;
}

function stopReceiverRelay(receiverId) {
  const rec = receivers.get(receiverId);
  const hadPersistedRelay = !!normalizeRelayConfig(rec?.relay);
  const stoppedLiveRelay = stopLiveRelay(receiverId);

  if (rec && hadPersistedRelay) {
    delete rec.relay;
    persistState();
  }

  return stoppedLiveRelay || hadPersistedRelay;
}

function stopReceiver(id) {
  const rec = receivers.get(id);
  if (!rec) return false;
  if (rec._proc) rec._proc.kill('SIGTERM');
  stopSocketServer(rec.socketPath);
  closePort(rec.listenPort, 'udp');
  stopLiveRelay(id); // stop ffmpeg relay if running
  rec.status = 'stopped';
  receivers.delete(id);
  log.info('Receiver stopped', { id, name: rec.name });
  persistState();
  return true;
}

async function restoreState() {
  const saved = loadState();
  if (!saved.length) return;
  log.info(`Restoring ${saved.length} receiver(s) from state`);
  for (const rec of saved) {
    const relayConfig = normalizeRelayConfig(rec.relay);
    try {
      await startReceiver({
        name: rec.name,
        listenPort: rec.listenPort,
        outputUrl: rec.outputUrl,
        secret: rec.secret,
        id: rec.id,
        createdAt: rec.createdAt,
        relay: relayConfig,
      });
      log.info('Receiver restored', { name: rec.name, port: rec.listenPort });
      if (relayConfig) {
        try {
          await startReceiverRelay(rec.id, relayConfig.srtPort, relayConfig.passphrase);
          log.info('Relay restored', { receiverId: rec.id, srtPort: relayConfig.srtPort });
        } catch (relayErr) {
          log.error('Failed to restore relay', { receiverId: rec.id, error: relayErr.message });
        }
      }
    } catch (err) {
      log.error('Failed to restore receiver', { name: rec.name, error: err.message });
    }
  }
}


function parseFlowsFromLogs(rec) {
  // Prefer the eagerly-captured last JSON stats line — survives log buffer floods.
  // Fall back to a backwards scan for receivers restored from state.
  let jsonStr = rec.lastJsonStats ?? null;
  if (!jsonStr) {
    for (let i = rec.logs.length - 1; i >= 0; i--) {
      const idx = rec.logs[i].indexOf('{"receiver-stats"');
      if (idx !== -1) { jsonStr = rec.logs[i].slice(idx); break; }
    }
  }
  if (!jsonStr) return [];

  try {
    const json = JSON.parse(jsonStr);
    const fi = json['receiver-stats']?.flowinstant;
    if (!fi) return [];
    const s = fi.stats || {};
    // IPs are observed on the Prometheus metrics socket (separate stream).
    // For each peer.id we look up the IP that librist labelled on its metrics.
    // Missing entries (early polls, mismatched id types) just yield null.
    const peerIpMap = getPeerIpMap(rec.socketPath, String(fi.flow_id));
    const peerIps = getPeerIps(rec.socketPath, String(fi.flow_id));
    const peers = (fi.peers || []).map((p, index) => {
      const ip = peerIpMap.get(String(p.id)) || peerIps[index] || null;
      const ispInfo = ip ? ispLookup.lookupSync(ip) : null;
      return {
        id: p.id,
        dead: p.dead ?? 0,
        rtt: p.stats?.rtt ?? 0,
        avgRtt: p.stats?.avg_rtt ?? 0,
        bitrate: p.stats?.bitrate ?? 0,
        avgBitrate: p.stats?.avg_bitrate ?? 0,
        ip,
        isp: ispInfo?.isp ?? null,
        country: ispInfo?.country ?? null,
      };
    });
    const activePeer = peers.find(p => p.dead === 0) || peers[0];
    return [{
      receiverId: rec.id,
      receiverName: rec.name,
      flowId: String(fi.flow_id),
      peerName: activePeer ? `peer (rtt ${Math.round(activePeer.rtt)}ms)` : 'peer',
      qualityRatio: (s.quality ?? 100) / 100,
      packetsReceived: s.received ?? 0,
      packetsRecovered: s.recovered_total ?? 0,
      packetsLost: s.lost ?? 0,
      bitrate: s.bitrate ?? 0,
      avgBufferTime: s.avg_buffer_time ?? 0,
      peers,
    }];
  } catch { return []; }
}

function getReceiverFlows(id) {
  const rec = receivers.get(id);
  if (!rec) return [];
  return parseFlowsFromLogs(rec);
}

function getAllFlows() {
  const flows = [];
  for (const rec of receivers.values()) {
    if (rec.status === 'running') flows.push(...parseFlowsFromLogs(rec));
  }
  return flows;
}

function listReceivers() {
  return Array.from(receivers.values()).map(toPublic);
}

function getReceiver(id) {
  const rec = receivers.get(id);
  return rec ? toPublic(rec) : null;
}

function parseUdpPort(outputUrl) {
  try {
    return parseInt(new URL(outputUrl).port, 10) || null;
  } catch { return null; }
}

function toPublic({ _proc, ...pub }) {
  const relay = getRelay(pub.id);
  if (relay) return { ...pub, relay };

  const savedRelay = normalizeRelayConfig(pub.relay);
  if (savedRelay) {
    return {
      ...pub,
      relay: {
        receiverId: pub.id,
        udpPort: parseUdpPort(pub.outputUrl),
        srtPort: savedRelay.srtPort,
        passphrase: savedRelay.passphrase || '',
        status: 'stopped',
        pid: null,
      },
    };
  }

  return { ...pub, relay: null };
}

function getBinaryStatus() {
  return { available: !!BINARY, path: BINARY || null };
}

function getUsedPorts() {
  return Array.from(receivers.values())
    .filter(r => r.status === 'running' || r.status === 'starting')
    .map(r => r.listenPort);
}

// Restore on startup
restoreState();

module.exports = {
  startReceiver, stopReceiver, startReceiverRelay, stopReceiverRelay,
  listReceivers, getReceiver, persistState,
  getReceiverFlows, getAllFlows, getBinaryStatus, getUsedPorts, receivers,
};

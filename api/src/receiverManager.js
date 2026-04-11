'use strict';
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { startSocketServer, stopSocketServer } = require('./metricsServer');
const { saveState, loadState } = require('./stateManager');

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

function startReceiver({ name, listenPort, outputUrl, id: existingId, createdAt: existingCreatedAt } = {}) {
  if (!BINARY) {
    throw new Error('ristreceiver binary not found. Install librist: brew install librist');
  }

  const id = existingId || uuidv4();
  const recName = name || `receiver-${listenPort}`;
  const socketPath = `/tmp/rist-metrics-${id}.sock`;
  const inputUrl = `rist://@0.0.0.0:${listenPort}`;

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
    listenPort,
    outputUrl,
    socketPath,
    status: 'starting',
    pid: proc.pid,
    createdAt: existingCreatedAt || new Date().toISOString(),
    logs: [],
  };

  const appendLog = (line) => {
    record.logs.push(line);
    if (record.logs.length > 200) record.logs.shift();
  };

  proc.stdout.on('data', d => appendLog(d.toString().trimEnd()));
  proc.stderr.on('data', d => appendLog(d.toString().trimEnd()));

  proc.on('spawn', () => {
    record.status = 'running';
    saveState(receivers);
  });
  proc.on('error', (err) => {
    record.status = 'error';
    record.error = err.message;
    stopSocketServer(socketPath);
    saveState(receivers);
  });
  proc.on('exit', (code) => {
    record.status = code === 0 ? 'stopped' : 'error';
    record.pid = null;
    stopSocketServer(socketPath);
    saveState(receivers);
  });

  setTimeout(() => {
    if (record.status === 'starting') {
      record.status = 'running';
      saveState(receivers);
    }
  }, 1500);

  record._proc = proc;
  receivers.set(id, record);
  saveState(receivers);
  return record;
}

function stopReceiver(id) {
  const rec = receivers.get(id);
  if (!rec) return false;
  if (rec._proc) rec._proc.kill('SIGTERM');
  stopSocketServer(rec.socketPath);
  rec.status = 'stopped';
  receivers.delete(id);
  saveState(receivers);
  return true;
}

/** Restore receivers from persisted state on startup */
function restoreState() {
  const saved = loadState();
  if (!saved.length) return;
  console.log(`[state] Restoring ${saved.length} receiver(s)…`);
  for (const rec of saved) {
    try {
      startReceiver({ name: rec.name, listenPort: rec.listenPort, outputUrl: rec.outputUrl, id: rec.id, createdAt: rec.createdAt });
      console.log(`[state] Restored: ${rec.name} (port ${rec.listenPort})`);
    } catch (err) {
      console.error(`[state] Failed to restore ${rec.name}: ${err.message}`);
    }
  }
}

/** Parse the latest receiver-stats JSON from ristreceiver log output */
function parseFlowsFromLogs(rec) {
  const lines = rec.logs.flatMap(entry => entry.split('\n'));

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const idx = line.indexOf('{"receiver-stats"');
    if (idx === -1) continue;
    try {
      const json = JSON.parse(line.slice(idx));
      const fi = json['receiver-stats']?.flowinstant;
      if (!fi) continue;
      const s = fi.stats || {};
      const peers = (fi.peers || []).map(p => ({
        id: p.id,
        dead: p.dead ?? 0,
        rtt: p.stats?.rtt ?? 0,
        avgRtt: p.stats?.avg_rtt ?? 0,
        bitrate: p.stats?.bitrate ?? 0,
        avgBitrate: p.stats?.avg_bitrate ?? 0,
      }));
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
    } catch { continue; }
  }
  return [];
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

function toPublic({ _proc, ...pub }) { return pub; }

function getBinaryStatus() {
  return { available: !!BINARY, path: BINARY || null };
}

// Restore on startup
restoreState();

module.exports = {
  startReceiver, stopReceiver, listReceivers, getReceiver,
  getReceiverFlows, getAllFlows, getBinaryStatus, receivers,
};

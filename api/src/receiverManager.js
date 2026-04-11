'use strict';
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { startSocketServer, stopSocketServer, getLatestFlows } = require('./metricsServer');

function findBinary() {
  const candidates = [
    process.env.RISTRECEIVER_BIN,
    '/opt/homebrew/bin/ristreceiver',
    '/usr/local/bin/ristreceiver',
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

/**
 * Start a new ristreceiver process.
 * @param {object} opts
 * @param {string} opts.name
 * @param {number} opts.listenPort  UDP port for incoming RIST
 * @param {string} opts.outputUrl   Where to forward decoded stream
 */
function startReceiver({ name, listenPort, outputUrl }) {
  if (!BINARY) {
    throw new Error(
      'ristreceiver binary not found. Install librist: brew install librist'
    );
  }

  const id = uuidv4();
  const recName = name || `receiver-${listenPort}`;
  const socketPath = `/tmp/rist-metrics-${id}.sock`;
  const inputUrl = `rist://@0.0.0.0:${listenPort}`;

  // Start our Unix socket server BEFORE launching ristreceiver so it can connect
  startSocketServer(socketPath, id, recName);

  const args = [
    '-i', inputUrl,
    '-o', outputUrl,
    '-S', '2000',              // stats interval 2000ms
    '-M',                      // --enable-metrics
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
    createdAt: new Date().toISOString(),
    logs: [],
  };

  const appendLog = (line) => {
    record.logs.push(line);
    if (record.logs.length > 200) record.logs.shift();
  };

  proc.stdout.on('data', d => appendLog(d.toString().trimEnd()));
  proc.stderr.on('data', d => appendLog(d.toString().trimEnd()));

  proc.on('spawn', () => { record.status = 'running'; });
  proc.on('error', (err) => {
    record.status = 'error';
    record.error = err.message;
    stopSocketServer(socketPath);
  });
  proc.on('exit', (code) => {
    record.status = code === 0 ? 'stopped' : 'error';
    record.pid = null;
    stopSocketServer(socketPath);
  });

  setTimeout(() => {
    if (record.status === 'starting') record.status = 'running';
  }, 1500);

  record._proc = proc;
  receivers.set(id, record);
  return record;
}

function stopReceiver(id) {
  const rec = receivers.get(id);
  if (!rec) return false;
  if (rec._proc) rec._proc.kill('SIGTERM');
  stopSocketServer(rec.socketPath);
  rec.status = 'stopped';
  receivers.delete(id);
  return true;
}

function getReceiverFlows(id) {
  const rec = receivers.get(id);
  if (!rec) return [];
  return getLatestFlows(rec.socketPath);
}

function getAllFlows() {
  const flows = [];
  for (const rec of receivers.values()) {
    if (rec.status === 'running') {
      flows.push(...getLatestFlows(rec.socketPath));
    }
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

module.exports = {
  startReceiver, stopReceiver, listReceivers, getReceiver,
  getReceiverFlows, getAllFlows, getBinaryStatus, receivers
};

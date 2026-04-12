'use strict';
const { spawn } = require('child_process');
const { openPort, closePort } = require('./portManager');
const log = require('./logger');

const relays = new Map(); // receiverId → relay record

function parseUdpPort(outputUrl) {
  try {
    return parseInt(new URL(outputUrl).port, 10) || null;
  } catch { return null; }
}

async function startRelay(receiverId, outputUrl, srtPort) {
  const udpPort = parseUdpPort(outputUrl);
  if (!udpPort) throw new Error(`Cannot parse UDP port from outputUrl: ${outputUrl}`);

  if (relays.has(receiverId)) {
    throw new Error('Relay already running for this receiver');
  }

  const args = [
    '-hide_banner', '-loglevel', 'warning',
    '-i', `udp://0.0.0.0:${udpPort}`,
    '-c', 'copy',
    '-f', 'mpegts',
    `srt://0.0.0.0:${srtPort}?mode=listener`,
  ];

  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const relay = {
    receiverId,
    udpPort,
    srtPort,
    status: 'starting',
    pid: proc.pid,
    logs: [],
    _proc: proc,
  };

  const appendLog = (line) => {
    relay.logs.push(line);
    if (relay.logs.length > 100) relay.logs.shift();
  };

  proc.stdout.on('data', d => appendLog(d.toString().trimEnd()));
  proc.stderr.on('data', d => appendLog(d.toString().trimEnd()));

  proc.on('spawn', () => {
    relay.status = 'running';
    openPort(srtPort, 'tcp');
    log.info('Relay started', { receiverId, udpPort, srtPort, pid: proc.pid });
  });

  proc.on('error', (err) => {
    relay.status = 'error';
    relay.error = err.message;
    log.error('Relay process error', { receiverId, error: err.message });
  });

  proc.on('exit', (code) => {
    relay.status = code === 0 ? 'stopped' : 'error';
    relay.pid = null;
    closePort(srtPort, 'tcp');
    relays.delete(receiverId);
    log.info('Relay exited', { receiverId, code });
  });

  relays.set(receiverId, relay);
  return toPublic(relay);
}

function stopRelay(receiverId) {
  const relay = relays.get(receiverId);
  if (!relay) return false;
  if (relay._proc) relay._proc.kill('SIGTERM');
  closePort(relay.srtPort, 'tcp');
  relays.delete(receiverId);
  log.info('Relay stopped', { receiverId });
  return true;
}

function getRelay(receiverId) {
  const relay = relays.get(receiverId);
  return relay ? toPublic(relay) : null;
}

function getAllRelays() {
  return Array.from(relays.values()).map(toPublic);
}

function stopAllRelays() {
  for (const id of Array.from(relays.keys())) stopRelay(id);
}

function getRelayLogs(receiverId) {
  return relays.get(receiverId)?.logs ?? null;
}

function toPublic({ _proc, logs, ...pub }) { return pub; }

module.exports = { startRelay, stopRelay, getRelay, getRelayLogs, getAllRelays, stopAllRelays };

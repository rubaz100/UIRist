'use strict';
const { spawn } = require('child_process');
const crypto = require('crypto');
const { openPort, closePort } = require('./portManager');
const log = require('./logger');

const relays = new Map(); // receiverId → relay record

function parseUdpPort(outputUrl) {
  try {
    return parseInt(new URL(outputUrl).port, 10) || null;
  } catch { return null; }
}

function generatePassphrase() {
  // SRT passphrase: 10–79 chars. 16 random bytes → 22 base64url chars.
  return crypto.randomBytes(16).toString('base64url');
}

async function startRelay(receiverId, outputUrl, srtPort, passphrase) {
  const udpPort = parseUdpPort(outputUrl);
  if (!udpPort) throw new Error(`Cannot parse UDP port from outputUrl: ${outputUrl}`);

  if (relays.has(receiverId)) {
    throw new Error('Relay already running for this receiver');
  }

  const srtPassphrase = passphrase || generatePassphrase();

  // UDP receive buffer: 12 MB — prevents packet loss on high-bitrate bursts from ristreceiver
  const UDP_RCVBUF = 12 * 1024 * 1024;
  // SRT latency in milliseconds (2000 ms gives SRT enough room to recover dropped packets)
  // maxbw=-1 = unlimited bandwidth, sndbuf/rcvbuf = 12 MB each
  const SRT_BUF = 12 * 1024 * 1024;

  const args = [
    `udp://:${udpPort}?rcvbuf=${UDP_RCVBUF}`,
    `srt://:${srtPort}?mode=listener&latency=2000&maxbw=-1&rcvbuf=${SRT_BUF}&sndbuf=${SRT_BUF}&passphrase=${encodeURIComponent(srtPassphrase)}&pbkeylen=16`,
  ];

  const proc = spawn('srt-live-transmit', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const relay = {
    receiverId,
    udpPort,
    srtPort,
    passphrase: srtPassphrase,
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
    openPort(srtPort, 'udp'); // SRT uses UDP at transport layer
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
    closePort(srtPort, 'udp');
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
  closePort(relay.srtPort, 'udp');
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

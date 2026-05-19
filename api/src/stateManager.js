'use strict';
const fs = require('fs');
const path = require('path');
const log = require('./logger');

const STATE_FILE = process.env.RIST_STATE_FILE || path.join(__dirname, '../../data/receivers.json');

function ensureDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeRelayConfig(relay) {
  if (!relay || typeof relay !== 'object') return null;

  const srtPort = Number(relay.srtPort);
  if (!Number.isInteger(srtPort) || srtPort < 1 || srtPort > 65535) return null;

  const config = { srtPort };
  if (typeof relay.passphrase === 'string' && relay.passphrase.length > 0) {
    config.passphrase = relay.passphrase;
  }
  return config;
}

function toPersistedReceiver({ _proc, logs, relay, ...rec }) {
  const persisted = { ...rec };
  const relayConfig = normalizeRelayConfig(relay);
  if (relayConfig) persisted.relay = relayConfig;
  return persisted;
}

function saveState(receivers) {
  try {
    ensureDir();
    const data = Array.from(receivers.values()).map(toPersistedReceiver);
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    log.error('Failed to save state', { error: err.message });
  }
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return [];
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    log.error('Failed to load state', { error: err.message });
    return [];
  }
}

module.exports = { saveState, loadState, normalizeRelayConfig };

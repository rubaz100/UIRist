'use strict';
const fs = require('fs');
const path = require('path');
const log = require('./logger');

const STATE_FILE = process.env.RIST_STATE_FILE || path.join(__dirname, '../../data/receivers.json');

function ensureDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveState(receivers) {
  try {
    ensureDir();
    const data = Array.from(receivers.values()).map(({ _proc, logs, ...rec }) => rec);
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

module.exports = { saveState, loadState };

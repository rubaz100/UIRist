'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('./logger');

// CONFIG_DIR defaults to /data inside container; bind-mounted to ./data on host.
// Override with CONFIG_DIR env var (e.g. for local dev or alternative paths).
const CONFIG_DIR = process.env.CONFIG_DIR || '/data';
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// All persisted settings — keep in sync with frontend SettingsContext + AuthContext
const DEFAULT_CONFIG = {
  srtApiKey: '',
  ristApiKey: '',
  ristApiUrl: '',
  ristServerHost: '',
  flowHistoryTimeout: 30,
  advancedMode: false,
  developerMode: false,
  showPortInUrls: false,
  showQrCodes: false,
};

// Env-var override mapping: any of these will replace file/default values at startup
const ENV_OVERRIDES = {
  srtApiKey: 'SRT_API_KEY',
  ristApiKey: 'RIST_API_KEY',
  ristApiUrl: 'RIST_API_URL',
  ristServerHost: 'RIST_SERVER_HOST',
  flowHistoryTimeout: 'FLOW_HISTORY_TIMEOUT',
  advancedMode: 'ADVANCED_MODE',
  developerMode: 'DEVELOPER_MODE',
  showPortInUrls: 'SHOW_PORT_IN_URLS',
  showQrCodes: 'SHOW_QR_CODES',
};

let currentConfig = { ...DEFAULT_CONFIG };
let lastError = null;

function ensureConfigDir() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
  } catch (err) {
    log.error('Failed to create config directory', { dir: CONFIG_DIR, error: err.message });
    throw err;
  }
}

function applyEnvOverrides(cfg) {
  const result = { ...cfg };
  for (const [key, envVar] of Object.entries(ENV_OVERRIDES)) {
    const val = process.env[envVar];
    if (val === undefined || val === '') continue;
    if (typeof DEFAULT_CONFIG[key] === 'boolean') {
      result[key] = val === 'true' || val === '1';
    } else if (typeof DEFAULT_CONFIG[key] === 'number') {
      const n = parseInt(val, 10);
      if (!isNaN(n)) result[key] = n;
    } else {
      result[key] = val;
    }
  }
  return result;
}

function loadConfig() {
  lastError = null;
  let fileConfig = {};
  let fileExists = false;

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fileExists = true;
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      fileConfig = JSON.parse(raw);
      log.info('Config loaded from file', { file: CONFIG_FILE });
    } else {
      log.info('No config file found, using defaults', { file: CONFIG_FILE });
    }
  } catch (err) {
    lastError = `Failed to load config from ${CONFIG_FILE}: ${err.message}`;
    log.error('Config load error', { error: err.message });
    fileConfig = {};
  }

  // Merge: defaults < file < env-vars
  const merged = applyEnvOverrides({ ...DEFAULT_CONFIG, ...fileConfig });
  currentConfig = merged;
  return { config: merged, error: lastError, fileExists };
}

function saveConfig(updates) {
  ensureConfigDir();

  // Validate keys: only allow known fields
  const sanitized = {};
  for (const [key, val] of Object.entries(updates)) {
    if (key in DEFAULT_CONFIG) {
      sanitized[key] = val;
    }
  }

  const newConfig = { ...currentConfig, ...sanitized };

  // Atomic write with restricted permissions
  const tmpFile = `${CONFIG_FILE}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(newConfig, null, 2), { mode: 0o600 });
    fs.renameSync(tmpFile, CONFIG_FILE);
    // Ensure permissions on final file (fs.rename preserves them, but enforce just in case)
    fs.chmodSync(CONFIG_FILE, 0o600);
    currentConfig = newConfig;
    log.info('Config saved', { file: CONFIG_FILE });
    return { config: newConfig, error: null };
  } catch (err) {
    lastError = `Failed to save config: ${err.message}`;
    log.error('Config save error', { error: err.message });
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
    throw err;
  }
}

function getConfig() {
  // Re-apply env overrides on read so they always win
  return applyEnvOverrides({ ...currentConfig });
}

function getStatus() {
  return { error: lastError, configFile: CONFIG_FILE };
}

// ── Encryption (AES-256-GCM with PBKDF2 key derivation) ──────────────────────
const ALG = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;
const PBKDF2_ITERATIONS = 200_000;
const TAG_LEN = 16;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256');
}

function encryptConfig(password) {
  if (!password || typeof password !== 'string' || password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const plain = Buffer.from(JSON.stringify(getConfig()), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Output format: {version, salt, iv, tag, ciphertext} — all base64
  return {
    version: 1,
    algorithm: ALG,
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    exportedAt: new Date().toISOString(),
  };
}

function decryptConfig(envelope, password) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Invalid envelope: must be an object');
  }
  if (envelope.version !== 1 || envelope.algorithm !== ALG) {
    throw new Error('Unsupported config envelope version or algorithm');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }

  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ct = Buffer.from(envelope.ciphertext, 'base64');
  const iterations = envelope.iterations || PBKDF2_ITERATIONS;

  if (salt.length !== SALT_LEN || iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error('Corrupted envelope: invalid field sizes');
  }

  const key = crypto.pbkdf2Sync(password, salt, iterations, KEY_LEN, 'sha256');
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);

  let plain;
  try {
    plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch (err) {
    throw new Error('Decryption failed — wrong password or corrupted file');
  }

  let parsed;
  try {
    parsed = JSON.parse(plain.toString('utf8'));
  } catch (err) {
    throw new Error('Decrypted payload is not valid JSON');
  }

  // Filter to known fields only
  const sanitized = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (key in parsed) sanitized[key] = parsed[key];
  }
  return sanitized;
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  getStatus,
  encryptConfig,
  decryptConfig,
  CONFIG_FILE,
};

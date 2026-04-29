'use strict';
// Validation helpers for SRT relay payloads.

const SRT_PASSPHRASE_MIN = 10;
const SRT_PASSPHRASE_MAX = 79;

function validateSrtPort(port) {
  if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
    return 'srtPort must be a number between 1 and 65535';
  }
  return null;
}

function validatePassphrase(passphrase) {
  if (passphrase === undefined) return null; // optional
  if (typeof passphrase !== 'string' || passphrase.length < SRT_PASSPHRASE_MIN || passphrase.length > SRT_PASSPHRASE_MAX) {
    return `SRT passphrase must be between ${SRT_PASSPHRASE_MIN} and ${SRT_PASSPHRASE_MAX} characters`;
  }
  return null;
}

module.exports = { validateSrtPort, validatePassphrase };

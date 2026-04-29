'use strict';
// Validation helpers for receiver-related payloads.
// Returns null if valid, or a string error message.

const NAME_MAX = 64;
const SECRET_MIN = 8;
const SECRET_MAX = 64;
// Allowed characters in a PSK secret. Avoids shell metacharacters and quoting issues
// since the value is interpolated into ristreceiver's URL.
const SECRET_PATTERN = /^[a-zA-Z0-9\-_.~!@#$%^&*]+$/;
// Output URL: udp:// or rtp:// only (ristreceiver constraint).
// Reject characters that could break shell or URL parsing.
const URL_FORBIDDEN_CHARS = /[;&|`$(){}[\]\\<>'"!]/;

function validateListenPort(port) {
  if (port === undefined || port === null) return 'listenPort is required';
  if (typeof port !== 'number' || port < 1 || port > 65535) {
    return 'listenPort must be a number between 1 and 65535';
  }
  return null;
}

function validateName(name) {
  if (name === undefined) return null; // optional
  if (typeof name !== 'string' || name.length > NAME_MAX) {
    return `name must be a string of max ${NAME_MAX} characters`;
  }
  return null;
}

function validateSecret(secret) {
  if (secret === undefined) return null; // optional
  if (typeof secret !== 'string' || secret.length < SECRET_MIN || secret.length > SECRET_MAX) {
    return `secret must be a string between ${SECRET_MIN} and ${SECRET_MAX} characters`;
  }
  if (!SECRET_PATTERN.test(secret)) {
    return 'secret contains invalid characters';
  }
  return null;
}

function validateOutputUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return 'outputUrl is required';
  if (!/^(udp|rtp):\/\//i.test(url)) {
    return 'outputUrl must use udp:// or rtp:// scheme (ristreceiver only supports UDP/RTP output)';
  }
  if (URL_FORBIDDEN_CHARS.test(url)) return 'outputUrl contains invalid characters';
  return null;
}

/** Validates a full create-receiver payload. Returns first error or null. */
function validateCreatePayload(body) {
  return (
    validateListenPort(body.listenPort) ||
    validateOutputUrl(body.outputUrl) ||
    validateName(body.name) ||
    validateSecret(body.secret)
  );
}

/** Validates an update payload (all fields optional, but if present must be valid). */
function validateUpdatePayload(body) {
  return (
    validateName(body.name) ||
    validateSecret(body.secret) ||
    (body.outputUrl !== undefined ? validateOutputUrl(body.outputUrl) : null)
  );
}

module.exports = {
  validateListenPort,
  validateName,
  validateSecret,
  validateOutputUrl,
  validateCreatePayload,
  validateUpdatePayload,
};

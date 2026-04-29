'use strict';

function validatePortNumber(port) {
  const n = typeof port === 'string' ? parseInt(port, 10) : port;
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    return { valid: false, error: 'Invalid port number', port: null };
  }
  return { valid: true, error: null, port: n };
}

module.exports = { validatePortNumber };

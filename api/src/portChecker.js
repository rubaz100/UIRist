'use strict';
const dgram = require('dgram');
const net   = require('net');

/**
 * Check if a UDP port is available by trying to bind it.
 */
function isUdpPortAvailable(port) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4');
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const timer = setTimeout(() => {
      try { sock.close(() => {}); } catch (_) {}
      done(false);
    }, 3000);
    sock.once('error', () => { clearTimeout(timer); done(false); });
    sock.bind(port, '0.0.0.0', () => { clearTimeout(timer); sock.close(() => done(true)); });
  });
}

/**
 * Check if a TCP port is available.
 */
function isTcpPortAvailable(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '0.0.0.0', () => srv.close(() => resolve(true)));
  });
}

/**
 * Well-known ports to warn about in the UI.
 * These are always "blocked" from the receiver's perspective.
 */
const RESERVED_PORTS = new Set([
  80, 443,          // HTTP/HTTPS
  3000, 3001,       // UIRist UI + API
  5000,             // SRTLA
  8181, 8282,       // bbox-receiver SLS + SRT output
  22, 53, 123,      // SSH, DNS, NTP
]);

module.exports = { isUdpPortAvailable, isTcpPortAvailable, RESERVED_PORTS };

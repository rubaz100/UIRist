'use strict';
const dgram = require('dgram');
const net   = require('net');

/**
 * Check if a UDP port is available by trying to bind it.
 */
function isUdpPortAvailable(port) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4');
    sock.once('error', () => resolve(false));
    sock.bind(port, '0.0.0.0', () => sock.close(() => resolve(true)));
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

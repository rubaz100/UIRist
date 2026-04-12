'use strict';
const { execFile } = require('child_process');
const log = require('./logger');

let _available = null; // cached check result

function run(args) {
  return new Promise((resolve) => {
    execFile('iptables', args, { timeout: 3000 }, (err) => resolve(!err));
  });
}

async function available() {
  if (_available !== null) return _available;
  _available = await run(['-L', 'INPUT', '-n', '--line-numbers']);
  if (!_available) log.warn('iptables unavailable — add cap_add: NET_ADMIN to docker-compose for auto port management');
  return _available;
}

async function openPort(port, protocol = 'udp') {
  if (!(await available())) return;
  const p = String(port);
  const rule = ['-p', protocol, '--dport', p, '-j', 'ACCEPT'];
  const exists = await run(['-C', 'INPUT', ...rule]);
  if (!exists) {
    await run(['-A', 'INPUT', ...rule]);
    log.info('iptables: opened', { port, protocol });
  }
}

async function closePort(port, protocol = 'udp') {
  if (!(await available())) return;
  await run(['-D', 'INPUT', '-p', protocol, '--dport', String(port), '-j', 'ACCEPT']);
  log.info('iptables: closed', { port, protocol });
}

module.exports = { openPort, closePort };

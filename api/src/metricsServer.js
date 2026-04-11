'use strict';
/**
 * Unix-socket metrics collector.
 * ristreceiver connects to a Unix socket and pushes Prometheus text.
 * We listen on the socket and keep the latest payload per receiver.
 */
const net = require('net');
const fs = require('fs');
const { parsePrometheus } = require('./metricsFetcher');

// Map: socketPath → { server, latestText, latestFlows }
const socketServers = new Map();

function startSocketServer(socketPath, receiverId, receiverName) {
  // Remove stale socket file
  try { fs.unlinkSync(socketPath); } catch {}

  const state = { latestText: '', latestFlows: [] };

  const server = net.createServer((conn) => {
    let buf = '';
    conn.on('data', (d) => { buf += d.toString(); });
    conn.on('end', () => {
      if (buf.trim()) {
        state.latestText = buf;
        state.latestFlows = samplesToFlows(parsePrometheus(buf), receiverId, receiverName);
      }
    });
    conn.on('error', () => {});
  });

  server.listen(socketPath, () => {});
  server.on('error', () => {});

  socketServers.set(socketPath, { server, state });
  return state;
}

function stopSocketServer(socketPath) {
  const entry = socketServers.get(socketPath);
  if (!entry) return;
  entry.server.close();
  try { fs.unlinkSync(socketPath); } catch {}
  socketServers.delete(socketPath);
}

function getLatestFlows(socketPath) {
  const entry = socketServers.get(socketPath);
  return entry ? entry.state.latestFlows : [];
}

/**
 * Extract a bare IP (without rist:// scheme and port) from a peer_name label.
 * ristreceiver typically outputs something like "rist://203.0.113.5:5004" or "203.0.113.5:5004".
 */
function parsePeerIp(peerName) {
  if (!peerName) return null;
  const stripped = peerName.replace(/^rist:\/\//i, '');
  const colonIdx = stripped.lastIndexOf(':');
  return colonIdx > 0 ? stripped.slice(0, colonIdx) : stripped || null;
}

function samplesToFlows(samples, receiverId, receiverName) {
  const flowMap = new Map();
  // Collect unique peer IPs per flow
  const peerIpsMap = new Map(); // flowId → Set<string>

  const getOrCreate = (flowId, peerName) => {
    if (!flowMap.has(flowId)) {
      flowMap.set(flowId, {
        flowId,
        peerName: peerName || '',
        receiverId,
        receiverName,
        qualityRatio: null,
        packetsReceived: 0,
        packetsRecovered: 0,
        packetsLost: 0,
      });
      peerIpsMap.set(flowId, new Set());
    }
    return flowMap.get(flowId);
  };

  for (const s of samples) {
    const id = s.labels['flow_id'] || s.labels['id'] || 'unknown';
    const peer = s.labels['peer_name'] || s.labels['peer'] || '';
    const flow = getOrCreate(id, peer);

    const ip = parsePeerIp(peer);
    if (ip) peerIpsMap.get(id)?.add(ip);

    if (s.name.includes('quality_ratio')) flow.qualityRatio = s.value;
    else if (s.name.includes('received_packets') || s.name.includes('packets_received'))
      flow.packetsReceived = s.value;
    else if (s.name.includes('recovered_packets') || s.name.includes('packets_recovered'))
      flow.packetsRecovered = s.value;
    else if (s.name.includes('lost_packets') || s.name.includes('packets_lost'))
      flow.packetsLost = s.value;
  }

  // Attach peer IPs to each flow
  for (const [flowId, flow] of flowMap) {
    flow.peerIps = Array.from(peerIpsMap.get(flowId) || []);
  }

  return Array.from(flowMap.values());
}

/** Return peer IP list for a given socket path and flow ID */
function getPeerIps(socketPath, flowId) {
  const entry = socketServers.get(socketPath);
  if (!entry) return [];
  const flow = entry.state.latestFlows.find(f => f.flowId === flowId);
  return flow?.peerIps ?? [];
}

module.exports = { startSocketServer, stopSocketServer, getLatestFlows, getPeerIps };

'use strict';
/**
 * Unix-socket metrics collector.
 * ristreceiver connects to a Unix socket and pushes Prometheus text.
 * We listen on the socket and keep the latest payload per receiver.
 *
 * In addition to the flow-level summary, we build a `peer_id → IP` map per flow
 * so consumers can correlate the JSON-stats peers (which have `id` but no IP)
 * with their real socket address.
 */
const net = require('net');
const fs = require('fs');
const { parsePrometheus } = require('./metricsFetcher');

// Map: socketPath → { server, state }
//   state = { latestText, latestFlows, peerIpsByFlow: Map<flowId, Map<peerId, ip>> }
const socketServers = new Map();

function startSocketServer(socketPath, receiverId, receiverName) {
  // Remove stale socket file
  try { fs.unlinkSync(socketPath); } catch {}

  const state = { latestText: '', latestFlows: [], peerIpsByFlow: new Map() };

  const server = net.createServer((conn) => {
    let buf = '';
    conn.on('data', (d) => { buf += d.toString(); });
    conn.on('end', () => {
      if (buf.trim()) {
        state.latestText = buf;
        const { flows, peerIpsByFlow } = samplesToFlows(
          parsePrometheus(buf), receiverId, receiverName,
        );
        state.latestFlows = flows;
        state.peerIpsByFlow = peerIpsByFlow;
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
 * Extract a bare IP (without scheme, brackets, or port) from a peer_name label.
 * ristreceiver outputs forms like:
 *   "rist://203.0.113.5:5004"
 *   "rist://[2001:db8::1]:5004"
 *   "203.0.113.5:5004"
 *   "203.0.113.5"
 * Returns null on empty input.
 */
function parsePeerIp(peerName) {
  if (!peerName) return null;
  let s = peerName.replace(/^rist:\/\//i, '').trim();
  if (!s) return null;

  // Bracketed IPv6: "[2001:db8::1]:5004" or "[2001:db8::1]"
  if (s.startsWith('[')) {
    const closing = s.indexOf(']');
    return closing > 0 ? s.slice(1, closing) : null;
  }
  // Bare IPv6 without brackets — heuristic: more than one colon → no port
  if ((s.match(/:/g) || []).length > 1) {
    return s;
  }
  // IPv4 with optional port
  const colonIdx = s.indexOf(':');
  return colonIdx > 0 ? s.slice(0, colonIdx) : s;
}

/**
 * Parse Prometheus samples into a flow summary plus per-flow peer-IP maps.
 *
 * Each sample's labels can carry `flow_id`, `peer_id`, and `peer_name`. We use
 * `peer_id` (when present) as the key for the IP map so callers can match it to
 * `fi.peers[].id` from the JSON `receiver-stats` stream.
 */
function samplesToFlows(samples, receiverId, receiverName) {
  const flowMap = new Map();
  // flowId → Set<ip>      (legacy flat list, kept for back-compat callers)
  const peerIpsSet = new Map();
  // flowId → Map<peerId, ip>   (new, used by receiverManager to enrich JSON peers)
  const peerIpMaps = new Map();

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
      peerIpsSet.set(flowId, new Set());
      peerIpMaps.set(flowId, new Map());
    }
    return flowMap.get(flowId);
  };

  for (const s of samples) {
    const flowId = s.labels['flow_id'] || s.labels['id'] || 'unknown';
    const peerName = s.labels['peer_name'] || s.labels['peer'] || '';
    const peerId = s.labels['peer_id'] || s.labels['peer'] || null;
    const flow = getOrCreate(flowId, peerName);

    const ip = parsePeerIp(peerName);
    if (ip) {
      peerIpsSet.get(flowId)?.add(ip);
      // peer_id can be missing on flow-level metrics — only map when present
      if (peerId != null && peerId !== '') {
        peerIpMaps.get(flowId)?.set(String(peerId), ip);
      }
    }

    if (s.name.includes('quality_ratio')) flow.qualityRatio = s.value;
    else if (s.name.includes('received_packets') || s.name.includes('packets_received'))
      flow.packetsReceived = s.value;
    else if (s.name.includes('recovered_packets') || s.name.includes('packets_recovered'))
      flow.packetsRecovered = s.value;
    else if (s.name.includes('lost_packets') || s.name.includes('packets_lost'))
      flow.packetsLost = s.value;
  }

  // Attach legacy peerIps array to each flow
  for (const [flowId, flow] of flowMap) {
    flow.peerIps = Array.from(peerIpsSet.get(flowId) || []);
  }

  return { flows: Array.from(flowMap.values()), peerIpsByFlow: peerIpMaps };
}

/** Return the flat peer IP list for a given socket path and flow ID (legacy callers). */
function getPeerIps(socketPath, flowId) {
  const entry = socketServers.get(socketPath);
  if (!entry) return [];
  const flow = entry.state.latestFlows.find(f => f.flowId === flowId);
  return flow?.peerIps ?? [];
}

/**
 * Return a Map<peerIdString, ip> for the given socket + flow. Empty map when
 * the socket hasn't received metrics yet or the flowId is unknown.
 */
function getPeerIpMap(socketPath, flowId) {
  const entry = socketServers.get(socketPath);
  if (!entry) return new Map();
  return entry.state.peerIpsByFlow.get(String(flowId)) || new Map();
}

module.exports = {
  startSocketServer, stopSocketServer,
  getLatestFlows, getPeerIps, getPeerIpMap,
  // exported for tests
  parsePeerIp,
};

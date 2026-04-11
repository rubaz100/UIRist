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

function samplesToFlows(samples, receiverId, receiverName) {
  const flowMap = new Map();

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
    }
    return flowMap.get(flowId);
  };

  for (const s of samples) {
    const id = s.labels['flow_id'] || s.labels['id'] || 'unknown';
    const peer = s.labels['peer_name'] || s.labels['peer'] || '';
    const flow = getOrCreate(id, peer);
    if (s.name.includes('quality_ratio')) flow.qualityRatio = s.value;
    else if (s.name.includes('received_packets') || s.name.includes('packets_received'))
      flow.packetsReceived = s.value;
    else if (s.name.includes('recovered_packets') || s.name.includes('packets_recovered'))
      flow.packetsRecovered = s.value;
    else if (s.name.includes('lost_packets') || s.name.includes('packets_lost'))
      flow.packetsLost = s.value;
  }

  return Array.from(flowMap.values());
}

module.exports = { startSocketServer, stopSocketServer, getLatestFlows };

'use strict';
const http = require('http');

// Parse Prometheus text format → array of { name, labels, value }
function parsePrometheus(text) {
  const samples = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const wl = line.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/
    );
    if (wl) {
      const labels = {};
      const re = /([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g;
      let m;
      while ((m = re.exec(wl[2])) !== null) labels[m[1]] = m[2];
      samples.push({ name: wl[1], labels, value: parseFloat(wl[3]) });
      continue;
    }
    const nl = line.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/
    );
    if (nl) samples.push({ name: nl[1], labels: {}, value: parseFloat(nl[2]) });
  }
  return samples;
}

// Fetch from a Unix socket path using Node's http module
function fetchUnixSocket(socketPath, path = '/metrics') {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { socketPath, path, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => resolve(data));
      }
    );
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

// Normalise parsed samples into RistFlow objects
function samplesToFlows(samples, receiver) {
  const flowMap = new Map();

  const getOrCreate = (flowId, peerName) => {
    if (!flowMap.has(flowId)) {
      flowMap.set(flowId, {
        flowId,
        peerName: peerName || '',
        receiverId: receiver.id,
        receiverName: receiver.name,
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

async function fetchReceiverFlows(receiver) {
  let text;
  if (receiver.socketPath) {
    text = await fetchUnixSocket(receiver.socketPath);
  } else {
    // Fallback: plain HTTP (e.g. mock server)
    const res = await fetch(receiver.metricsUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  }
  return samplesToFlows(parsePrometheus(text), receiver);
}

async function fetchAllFlows(receivers) {
  const results = await Promise.allSettled(
    Array.from(receivers.values())
      .filter(r => r.status === 'running')
      .map(r => fetchReceiverFlows(r))
  );
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

module.exports = { fetchReceiverFlows, fetchAllFlows, parsePrometheus };

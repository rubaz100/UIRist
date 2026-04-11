#!/usr/bin/env node
/**
 * RIST Mock Metrics Server
 * Simulates ristreceiver Prometheus/OpenMetrics output on port 9100.
 * Used for local UI testing without a real RIST receiver.
 *
 * Usage: node rist-mock-server.js
 */

const http = require('http');

const PORT = 9100;

// Simulated flows
const flows = [
  { id: 'flow-001', peer: 'encoder-main',   baseQuality: 0.999 },
  { id: 'flow-002', peer: 'encoder-backup', baseQuality: 0.972 },
  { id: 'flow-003', peer: 'mobile-bonding', baseQuality: 0.911 },
];

// Running packet counters
const counters = flows.map(() => ({
  received:  Math.floor(Math.random() * 500000),
  recovered: Math.floor(Math.random() * 500),
  lost:      Math.floor(Math.random() * 50),
}));

function jitter(base, range) {
  const v = base + (Math.random() - 0.5) * range;
  return Math.min(1, Math.max(0, v));
}

function buildMetrics() {
  const ts = Date.now();

  // Increment counters on every scrape (simulates live traffic ~10 Mbit/s)
  flows.forEach((_, i) => {
    counters[i].received  += Math.floor(Math.random() * 150) + 50;
    counters[i].recovered += Math.random() < 0.15 ? 1 : 0;
    counters[i].lost      += Math.random() < 0.02 ? 1 : 0;
  });

  const lines = [];

  // ── quality_ratio ──────────────────────────────────────────────────────────
  lines.push('# HELP rist_client_flow_quality_ratio Quality ratio of RIST client flows');
  lines.push('# TYPE rist_client_flow_quality_ratio gauge');
  lines.push('# UNIT rist_client_flow_quality_ratio ratio');
  flows.forEach((f, i) => {
    const q = jitter(f.baseQuality, 0.01).toFixed(6);
    lines.push(`rist_client_flow_quality_ratio{flow_id="${f.id}",peer_name="${f.peer}"} ${q}`);
  });

  // ── received packets ───────────────────────────────────────────────────────
  lines.push('# HELP rist_receiver_flow_received_packets_total Total packets received');
  lines.push('# TYPE rist_receiver_flow_received_packets_total counter');
  flows.forEach((f, i) => {
    lines.push(`rist_receiver_flow_received_packets_total{flow_id="${f.id}",peer_name="${f.peer}"} ${counters[i].received}`);
  });

  // ── recovered packets ──────────────────────────────────────────────────────
  lines.push('# HELP rist_receiver_flow_recovered_packets_total Packets recovered via ARQ');
  lines.push('# TYPE rist_receiver_flow_recovered_packets_total counter');
  flows.forEach((f, i) => {
    lines.push(`rist_receiver_flow_recovered_packets_total{flow_id="${f.id}",peer_name="${f.peer}"} ${counters[i].recovered}`);
  });

  // ── lost packets ───────────────────────────────────────────────────────────
  lines.push('# HELP rist_receiver_flow_lost_packets_total Packets permanently lost');
  lines.push('# TYPE rist_receiver_flow_lost_packets_total counter');
  flows.forEach((f, i) => {
    lines.push(`rist_receiver_flow_lost_packets_total{flow_id="${f.id}",peer_name="${f.peer}"} ${counters[i].lost}`);
  });

  lines.push('# EOF');
  return lines.join('\n') + '\n';
}

const server = http.createServer((req, res) => {
  // CORS headers – required for browser fetch
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/metrics' && req.method === 'GET') {
    const body = buildMetrics();
    res.writeHead(200, {
      'Content-Type': 'application/openmetrics-text; version=1.0.0; charset=utf-8',
    });
    res.end(body);
    console.log(`[${new Date().toISOString()}] GET /metrics  (flows: ${flows.length})`);
    return;
  }

  res.writeHead(404);
  res.end('Not found\n');
});

server.listen(PORT, () => {
  console.log(`\nRIST Mock Metrics Server running on http://localhost:${PORT}/metrics`);
  console.log(`Simulating ${flows.length} flows:`);
  flows.forEach(f => console.log(`  • ${f.id}  peer=${f.peer}  quality~${(f.baseQuality * 100).toFixed(1)}%`));
  console.log('\nPress Ctrl+C to stop.\n');
});

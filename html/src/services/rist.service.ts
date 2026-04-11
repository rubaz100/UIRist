import { RistFlow } from '../types/rist.types';
import { parsePrometheusText, findMetrics } from '../utils/prometheus-parser';

// Fetch RIST flows from a ristreceiver Prometheus /metrics endpoint.
// The metricsUrl must be CORS-accessible (e.g. behind an nginx proxy with
// "add_header Access-Control-Allow-Origin *").
export async function getRistFlows(metricsUrl: string): Promise<RistFlow[]> {
  const response = await fetch(metricsUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${metricsUrl}`);
  }
  const text = await response.text();
  return parseRistMetrics(text);
}

// Exported for unit-testing without network access
export function parseRistMetrics(text: string): RistFlow[] {
  const parsed = parsePrometheusText(text);

  // Quality ratio — try both receiver and client variants
  const qualitySamples = findMetrics(parsed, 'quality_ratio');

  // Build a map of flowId → RistFlow using the quality samples as the source of truth
  const flowMap = new Map<string, RistFlow>();

  for (const sample of qualitySamples) {
    const flowId = sample.labels['flow_id'] ?? sample.labels['id'] ?? 'unknown';
    const peerName = sample.labels['peer_name'] ?? sample.labels['peer'] ?? '';
    flowMap.set(flowId, {
      flowId,
      peerName,
      qualityRatio: isNaN(sample.value) ? 0 : sample.value,
      packetsReceived: 0,
      packetsRecovered: 0,
      packetsLost: 0,
      bitrate: 0,
      avgBufferTime: 0,
      peers: [],
    });
  }

  // Fill packet counters
  const fillCounter = (substrings: string[], field: keyof RistFlow) => {
    const samples = findMetrics(parsed, ...substrings);
    for (const sample of samples) {
      const flowId = sample.labels['flow_id'] ?? sample.labels['id'] ?? 'unknown';
      const existing = flowMap.get(flowId);
      if (existing) {
        (existing as any)[field] = isNaN(sample.value) ? 0 : sample.value;
      }
    }
  };

  fillCounter(['received_packets', 'packets_received'], 'packetsReceived');
  fillCounter(['recovered_packets', 'packets_recovered'], 'packetsRecovered');
  fillCounter(['lost_packets', 'packets_lost'], 'packetsLost');

  return Array.from(flowMap.values());
}

export interface PrometheusMetric {
  labels: Record<string, string>;
  value: number;
}

export type ParsedMetrics = Map<string, PrometheusMetric[]>;

function parseLabels(labelsStr: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(labelsStr)) !== null) {
    labels[m[1]] = m[2];
  }
  return labels;
}

// Parse Prometheus/OpenMetrics text format into a Map of metric name → samples
export function parsePrometheusText(text: string): ParsedMetrics {
  const result: ParsedMetrics = new Map();
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) continue;

    // Line with labels: metric_name{k="v",...} value [timestamp]
    const withLabels = line.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/
    );
    if (withLabels) {
      const name = withLabels[1];
      const labelsStr = withLabels[2];
      const valueStr = withLabels[3];
      const labels = parseLabels(labelsStr);
      const samples = result.get(name) || [];
      samples.push({ labels, value: parseFloat(valueStr) });
      result.set(name, samples);
      continue;
    }

    // Line without labels: metric_name value [timestamp]
    const noLabels = line.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/
    );
    if (noLabels) {
      const name = noLabels[1];
      const valueStr = noLabels[2];
      const samples = result.get(name) || [];
      samples.push({ labels: {}, value: parseFloat(valueStr) });
      result.set(name, samples);
    }
  }

  return result;
}

// Find metrics whose name contains any of the given substrings
export function findMetrics(
  parsed: ParsedMetrics,
  ...substrings: string[]
): PrometheusMetric[] {
  const keys = Array.from(parsed.keys());
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    for (let j = 0; j < substrings.length; j++) {
      if (key.indexOf(substrings[j]) !== -1) {
        return parsed.get(key)!;
      }
    }
  }
  return [];
}

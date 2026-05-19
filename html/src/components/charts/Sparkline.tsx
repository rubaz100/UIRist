import React, { useMemo } from 'react';

interface SparklineProps {
  /** Time-series samples in render order (oldest first, newest last). */
  samples: number[];
  /** Maximum sample slots — older values scroll off the left. Default 60. */
  maxSamples?: number;
  /** SVG width in pixels. Default 200. */
  width?: number;
  /** SVG height in pixels. Default 100. */
  height?: number;
  /** Stroke + gradient base color. Accepts any CSS color. Default JDownloader-style green. */
  color?: string;
  /** Override the Y-axis ceiling. By default the chart auto-scales to max(samples)*1.1. */
  yMax?: number;
  /** Show a 4×4 grid in the background. Default true. */
  showGrid?: boolean;
}

/**
 * JDownloader-style sparkline: smooth area chart with gradient fill, subtle grid,
 * and a stroked top line. All rendered in pure SVG — no chart library dependency.
 *
 * Designed to embed inside a small square card, but width/height are configurable.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  samples,
  maxSamples = 60,
  width = 200,
  height = 100,
  color = '#28c76f', // JDownloader-ish soft green
  yMax,
  showGrid = true,
}) => {
  const gradientId = useMemo(
    () => `spark-grad-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  // Always render across the full width using `maxSamples` slots, so the line
  // grows from the right edge as data comes in (instead of stretching across
  // the whole width with only 2 samples). Empty slots are skipped from the path.
  const { pathLine, pathArea, currentTop } = useMemo(() => {
    if (samples.length === 0) {
      return { pathLine: '', pathArea: '', currentTop: height };
    }

    // Compute Y scale
    const dataMax = Math.max(...samples, 1);
    const scaleMax = yMax !== undefined ? yMax : dataMax * 1.1;

    // X positions: most recent sample at the right edge, evenly spaced backwards
    const slotW = width / Math.max(maxSamples - 1, 1);
    const points = samples.map((v, i) => {
      // Right-aligned: last sample sits at x = width
      const slotIndex = maxSamples - samples.length + i;
      const x = slotIndex * slotW;
      const y = height - (Math.min(v, scaleMax) / scaleMax) * height;
      return { x, y };
    });

    // Build smooth path with Catmull-Rom-ish cubic bezier curves (simple approximation)
    let line = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const midX = (prev.x + cur.x) / 2;
      // C ctrl1 ctrl2 end — two halves of an S curve
      line += ` C ${midX.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${cur.y.toFixed(2)}, ${cur.x.toFixed(2)} ${cur.y.toFixed(2)}`;
    }

    // Area path: same line, then close down to the bottom-right and along the floor to the bottom-left of the line's start
    const area = `${line} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;

    return { pathLine: line, pathArea: area, currentTop: points[points.length - 1].y };
  }, [samples, maxSamples, width, height, yMax]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor={color} stopOpacity="0.55" />
          <stop offset="60%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {showGrid && (
        <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
          {/* 4 horizontal + 4 vertical grid lines */}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={`h${f}`} x1="0" y1={height * f} x2={width} y2={height * f} />
          ))}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={`v${f}`} x1={width * f} y1="0" x2={width * f} y2={height} />
          ))}
          {/* Baseline */}
          <line x1="0" y1={height - 0.5} x2={width} y2={height - 0.5} stroke="rgba(255,255,255,0.1)" />
        </g>
      )}

      {pathArea && <path d={pathArea} fill={`url(#${gradientId})`} />}
      {pathLine && (
        <path
          d={pathLine}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Current-value dot at the right edge */}
      {samples.length > 0 && pathLine && (
        <circle cx={width} cy={currentTop} r="2.5" fill={color} stroke="#0d0d0d" strokeWidth="1" />
      )}
    </svg>
  );
};

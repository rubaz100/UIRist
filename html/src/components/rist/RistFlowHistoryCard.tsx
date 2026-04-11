import React from 'react';
import { HistoryFlow } from '../../types/rist.types';

interface Props {
  flow: HistoryFlow;
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${bps} bps`;
}

function timeAgo(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

export const RistFlowHistoryCard: React.FC<Props> = ({ flow }) => {
  const peakPeers = flow.peers?.length ?? 0;
  const qualityPct = (flow.qualityRatio * 100).toFixed(1);

  return (
    <div
      className="d-flex align-items-center gap-3 px-3 py-2 rounded mb-2"
      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <i className="bi bi-clock-history text-muted" style={{ fontSize: '0.9rem' }} />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="d-flex align-items-center gap-2">
          <span className="small font-monospace text-muted text-truncate" style={{ maxWidth: 140 }} title={flow.flowId}>
            {flow.flowId}
          </span>
          {flow.receiverName && (
            <span className="small text-muted text-truncate">
              <i className="bi bi-hdd-network me-1 text-info" style={{ fontSize: '0.7rem' }} />
              {flow.receiverName}
            </span>
          )}
        </div>
        <div className="d-flex gap-3 mt-1">
          <span className="small text-muted">
            <span className="me-1">↓</span>{formatBitrate(flow.bitrate)}
          </span>
          <span className="small text-muted">
            Q {qualityPct}%
          </span>
          {peakPeers > 0 && (
            <span className="small text-muted">
              {peakPeers} peer{peakPeers !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <span className="small text-muted text-nowrap" style={{ fontSize: '0.7rem' }}>
        {timeAgo(flow.disappearedAt)}
      </span>
    </div>
  );
};

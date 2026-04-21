import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import { RistFlow } from '../../types/rist.types';
import { StatItem } from '../publisher/StatItem';

interface RistFlowCardProps {
  flow: RistFlow;
}

function qualityVariant(ratio: number): { color: string; label: string } {
  if (ratio >= 0.99) return { color: 'text-success', label: 'Excellent' };
  if (ratio >= 0.95) return { color: 'text-warning', label: 'Degraded' };
  return { color: 'text-danger', label: 'Poor' };
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${bps} bps`;
}

export const RistFlowCard: React.FC<RistFlowCardProps> = ({ flow }) => {
  const { color, label } = qualityVariant(flow.qualityRatio);
  const qualityPct = (flow.qualityRatio * 100).toFixed(2);
  const activePeers = flow.peers?.filter(p => p.dead === 0) ?? [];
  const deadPeers = flow.peers?.filter(p => p.dead !== 0) ?? [];

  return (
    <Card className="mb-3">
      <Card.Body>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
          <div className="d-flex flex-column" style={{ minWidth: 0 }}>
            <h5 className="mb-1 d-flex align-items-center gap-2">
              <i className="bi bi-diagram-3"></i>
              <span className="text-truncate small text-muted font-monospace">{flow.flowId}</span>
            </h5>
            {flow.receiverName && (
              <p className="text-muted mb-0 small">
                <i className="bi bi-hdd-network me-1 text-info"></i>{flow.receiverName}
              </p>
            )}
          </div>

          <div
            className="d-flex align-items-center px-3 py-1 rounded-pill flex-shrink-0"
            style={{
              backgroundColor: flow.qualityRatio >= 0.99 ? 'rgba(25,135,84,0.2)' : flow.qualityRatio >= 0.95 ? 'rgba(255,193,7,0.2)' : 'rgba(220,53,69,0.2)',
              border: `1px solid ${flow.qualityRatio >= 0.99 ? 'rgba(25,135,84,0.3)' : flow.qualityRatio >= 0.95 ? 'rgba(255,193,7,0.3)' : 'rgba(220,53,69,0.3)'}`,
            }}
          >
            <span
              className={`d-inline-block rounded-circle me-2 ${flow.qualityRatio >= 0.99 ? 'bg-success pulse' : flow.qualityRatio >= 0.95 ? 'bg-warning' : 'bg-danger'}`}
              style={{ width: 8, height: 8 }}
            />
            <span className={`small fw-medium ${color}`}>{label}</span>
          </div>
        </div>

        {/* Flow stats */}
        <div className="stats-grid mb-3">
          <StatItem icon="bi bi-bar-chart" label="Quality" value={`${qualityPct} %`} isDanger={flow.qualityRatio < 0.95} />
          <StatItem icon="bi bi-speedometer2" label="Bitrate" value={formatBitrate(flow.bitrate)} />
          <StatItem icon="bi bi-check2-circle" label="Received" value={flow.packetsReceived} />
          <StatItem icon="bi bi-arrow-repeat" label="Recovered" value={flow.packetsRecovered} />
          <StatItem icon="bi bi-x-octagon" label="Lost" value={flow.packetsLost} isDanger={flow.packetsLost > 0} />
          <StatItem icon="bi bi-hourglass-split" label="Buffer" value={`${flow.avgBufferTime} ms`} />
        </div>

        {/* Peers */}
        {flow.peers?.length > 0 && (
          <div>
            <div className="text-muted small mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-people"></i>
              <span>
                {activePeers.length} active connection{activePeers.length !== 1 ? 's' : ''}
                {deadPeers.length > 0 && <span className="text-muted"> · {deadPeers.length} dead</span>}
              </span>
            </div>
            <div className="d-flex flex-column gap-1">
              {flow.peers.map((peer, index) => (
                <div key={peer.id} className="d-flex align-items-center gap-2 px-2 py-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <Badge bg={peer.dead === 0 ? 'success' : 'secondary'} style={{ fontSize: '0.65rem' }}>
                    {peer.dead === 0 ? 'live' : 'dead'}
                  </Badge>
                  <span className="small text-muted">
                    Peer #{index + 1}
                  </span>
                  <span className="small ms-auto">
                    <span className="text-muted me-2">RTT</span>
                    <span className={peer.rtt > 200 ? 'text-warning' : ''}>{Math.round(peer.rtt)} ms</span>
                  </span>
                  <span className="small">
                    <span className="text-muted me-1">↓</span>{formatBitrate(peer.bitrate)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

import React from 'react';
import { Card } from 'react-bootstrap';
import { RistFlow } from '../../types/rist.types';
import { StatItem } from '../publisher/StatItem';

interface RistFlowCardProps {
  flow: RistFlow;
}

// Returns a Bootstrap color class and label based on quality ratio
function qualityVariant(ratio: number): { color: string; label: string } {
  if (ratio >= 0.99) return { color: 'text-success', label: 'Excellent' };
  if (ratio >= 0.95) return { color: 'text-warning', label: 'Degraded' };
  return { color: 'text-danger', label: 'Poor' };
}

export const RistFlowCard: React.FC<RistFlowCardProps> = ({ flow }) => {
  const { color, label } = qualityVariant(flow.qualityRatio);
  const qualityPct = (flow.qualityRatio * 100).toFixed(2);

  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
          <div className="d-flex flex-column" style={{ minWidth: 0 }}>
            <h5 className="mb-1 d-flex align-items-center">
              <i className="bi bi-diagram-3 me-2"></i>
              <span className="text-truncate">{flow.flowId}</span>
            </h5>
            {flow.peerName && (
              <p className="text-muted mb-0 small">{flow.peerName}</p>
            )}
          </div>

          <div
            className="d-flex align-items-center px-3 py-1 rounded-pill flex-shrink-0"
            style={{
              backgroundColor:
                flow.qualityRatio >= 0.99
                  ? 'rgba(25,135,84,0.2)'
                  : flow.qualityRatio >= 0.95
                  ? 'rgba(255,193,7,0.2)'
                  : 'rgba(220,53,69,0.2)',
              border: `1px solid ${
                flow.qualityRatio >= 0.99
                  ? 'rgba(25,135,84,0.3)'
                  : flow.qualityRatio >= 0.95
                  ? 'rgba(255,193,7,0.3)'
                  : 'rgba(220,53,69,0.3)'
              }`,
            }}
          >
            <span
              className={`d-inline-block rounded-circle me-2 ${
                flow.qualityRatio >= 0.99
                  ? 'bg-success pulse'
                  : flow.qualityRatio >= 0.95
                  ? 'bg-warning'
                  : 'bg-danger'
              }`}
              style={{ width: '8px', height: '8px' }}
            />
            <span className={`small fw-medium ${color}`}>{label}</span>
          </div>
        </div>

        <div className="stats-grid">
          <StatItem
            icon="bi bi-bar-chart"
            label="Quality"
            value={`${qualityPct} %`}
            isDanger={flow.qualityRatio < 0.95}
          />
          <StatItem
            icon="bi bi-check2-circle"
            label="Received"
            value={flow.packetsReceived}
          />
          <StatItem
            icon="bi bi-arrow-repeat"
            label="Recovered"
            value={flow.packetsRecovered}
          />
          <StatItem
            icon="bi bi-x-octagon"
            label="Lost"
            value={flow.packetsLost}
            isDanger={flow.packetsLost > 0}
          />
        </div>
      </Card.Body>
    </Card>
  );
};

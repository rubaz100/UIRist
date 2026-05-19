import React from 'react';
import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { RistPeer } from '../../types';
import { Sparkline } from '../charts';
import { countryCodeToFlag } from '../../utils/countryFlag';

interface PeerGraphCardProps {
  peer: RistPeer;
  peerIndex: number;
  samples: number[];
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} kbps`;
  return `${bps} bps`;
}

const CARD_SIZE = 200; // square: 200×200 px
const CHART_HEIGHT = 100;

/**
 * Square card showing one peer's live bitrate as a JDownloader-style sparkline.
 * Used in a responsive grid inside RistFlowCard.
 */
export const PeerGraphCard: React.FC<PeerGraphCardProps> = ({ peer, peerIndex, samples }) => {
  const isAlive = peer.dead === 0;
  const peerLabel = peer.ip || 'IP pending';
  // Slightly dim dead peers but still render them so users see the timeline of when they died.
  const color = isAlive ? '#28c76f' : '#6c757d';

  return (
    <div
      className="rounded position-relative overflow-hidden"
      style={{
        width: CARD_SIZE,
        height: CARD_SIZE,
        background: '#0d0d0d',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Top row: status badge + peer label */}
      <div className="d-flex justify-content-between align-items-center px-2 pt-2">
        <span className="d-flex align-items-center gap-1">
          <Badge bg={isAlive ? 'success' : 'secondary'} style={{ fontSize: '0.6rem' }}>
            {isAlive ? 'live' : 'dead'}
          </Badge>
          <span
            className={`text-muted text-truncate ${peer.ip ? 'font-monospace' : ''}`}
            style={{ fontSize: '0.7rem', maxWidth: 112 }}
            title={peer.ip || `Peer ${peerIndex + 1}`}
          >
            {peerLabel}
          </span>
        </span>
        <span className="text-muted" style={{ fontSize: '0.65rem' }}>
          RTT <span className={peer.rtt > 200 ? 'text-warning' : ''}>{Math.round(peer.rtt)}ms</span>
        </span>
      </div>

      {/* Current bitrate — big number */}
      <div className="px-2 pt-1">
        <div className="d-flex align-items-baseline gap-1">
          <i className="bi bi-arrow-down text-muted" style={{ fontSize: '0.7rem' }}></i>
          <span className="fw-semibold" style={{ fontSize: '1.1rem', color }}>
            {formatBitrate(peer.bitrate)}
          </span>
        </div>
        {peer.avgBitrate > 0 && (
          <div className="text-muted" style={{ fontSize: '0.65rem' }}>
            avg {formatBitrate(peer.avgBitrate)}
          </div>
        )}
        {(peer.isp || peer.country) && (
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>{[peer.isp, peer.ip].filter(Boolean).join(' · ')}</Tooltip>}
          >
            <div
              className="text-muted text-truncate d-flex align-items-center gap-1"
              style={{ fontSize: '0.65rem', maxWidth: CARD_SIZE - 16 }}
            >
              {(() => {
                const flag = countryCodeToFlag(peer.country);
                return flag ? <span aria-hidden="true">{flag}</span> : null;
              })()}
              {peer.isp ? (
                <>
                  <span className="text-truncate">{peer.isp}</span>
                </>
              ) : (
                <span className="text-truncate">Resolved</span>
              )}
            </div>
          </OverlayTrigger>
        )}
      </div>

      {/* Sparkline anchored to the bottom — full width */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Sparkline
          samples={samples}
          width={CARD_SIZE}
          height={CHART_HEIGHT}
          color={color}
        />
      </div>
    </div>
  );
};

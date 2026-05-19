import React, { useState } from 'react';
import { CopyButton, IconToggleButton } from '../common';
import { QrCollapse } from './QrCollapse';
import { buildRistUrl, buildRistUrlMasked } from '../../utils/streamUrls';

interface RistUrlPanelProps {
  host: string;
  port: number;
  secret?: string;
  showPort: boolean;
  showQrCodes: boolean;
}

/**
 * Shows the RIST input URL with show/hide secret toggle, copy button,
 * and optional QR code. Copy always copies the real URL (independent of mask).
 */
export const RistUrlPanel: React.FC<RistUrlPanelProps> = ({ host, port, secret, showPort, showQrCodes }) => {
  const [secretVisible, setSecretVisible] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const opts = { host, port, secret, showPort };
  const url = buildRistUrl(opts);
  const masked = buildRistUrlMasked(opts);

  return (
    <div className="small mb-1">
      <div className="d-flex align-items-center gap-1 flex-wrap">
        <span className="text-muted" style={{ minWidth: 80, fontSize: '0.75rem' }}>
          <i className="bi bi-broadcast me-1 text-info opacity-75"></i>RIST Input
        </span>
        <code className="text-info" style={{ fontSize: '0.72rem' }}>
          {secretVisible ? url : masked}
        </code>
        <IconToggleButton
          icon="eye"
          iconActive="eye-slash"
          active={secretVisible}
          onToggle={() => setSecretVisible(v => !v)}
          tooltipOn="Hide password"
          tooltipOff="Show password"
        />
        <CopyButton text={url} />
        {showQrCodes && (
          <IconToggleButton
            icon="qr-code"
            active={qrOpen}
            onToggle={() => setQrOpen(v => !v)}
            tooltipOn="Close QR"
            tooltipOff="Show QR"
          />
        )}
      </div>
      {showQrCodes && <QrCollapse open={qrOpen} value={url} />}
    </div>
  );
};

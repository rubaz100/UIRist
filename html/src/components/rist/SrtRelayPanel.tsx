import React, { useState } from 'react';
import { Form, Button, Badge, InputGroup } from 'react-bootstrap';
import { RistRelay } from '../../types';
import { CopyButton, IconToggleButton } from '../common';
import { QrCollapse } from './QrCollapse';
import { buildSrtObsUrl, buildSrtObsUrlMasked } from '../../utils/streamUrls';
import { generateSecret } from '../../utils/passphrase';

const DEFAULT_SRT_PORT = '5002';
const SRT_PASSPHRASE_LEN = 20;

function relayBadgeVariant(status: RistRelay['status']): string {
  if (status === 'running') return 'success';
  if (status === 'error')   return 'danger';
  return 'warning';
}

// ── Display: shown when a relay is running ────────────────────────────────
interface SrtRelayDisplayProps {
  host: string;
  relay: RistRelay;
  showQrCodes: boolean;
}

const SrtRelayDisplay: React.FC<SrtRelayDisplayProps> = ({ host, relay, showQrCodes }) => {
  const [passphraseVisible, setPassphraseVisible] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const opts = { host, port: relay.srtPort, passphrase: relay.passphrase };
  const url = buildSrtObsUrl(opts);
  const masked = buildSrtObsUrlMasked(opts);

  return (
    <div
      className="mt-1 mb-1 p-2 rounded"
      style={{ background: 'rgba(25,135,84,0.08)', border: '1px solid rgba(25,135,84,0.2)', fontSize: '0.72rem' }}
    >
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="text-success fw-semibold d-flex align-items-center gap-1">
          <i className="bi bi-play-circle"></i> SRT Pull
          <Badge bg={relayBadgeVariant(relay.status)} className="ms-1" style={{ fontSize: '0.55rem' }}>
            {relay.status}
          </Badge>
        </span>
        <div className="d-flex align-items-center gap-1">
          <IconToggleButton
            icon="eye"
            iconActive="eye-slash"
            active={passphraseVisible}
            onToggle={() => setPassphraseVisible(v => !v)}
            tooltipOn="Hide passphrase"
            tooltipOff="Show passphrase"
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
      </div>

      <div className="d-flex align-items-center gap-1 flex-wrap">
        <span className="text-muted" style={{ minWidth: 40 }}>
          <i className="bi bi-camera-video me-1"></i>OBS
        </span>
        <code className="text-success" style={{ wordBreak: 'break-all' }}>
          {passphraseVisible ? url : masked}
        </code>
      </div>
      <div className="text-muted mt-1" style={{ paddingLeft: 44, fontSize: '0.68rem' }}>
        Input Format: <code>mpegts</code>
      </div>

      {showQrCodes && <QrCollapse open={qrOpen} value={url} />}
    </div>
  );
};

// ── Start form: shown when no relay running and user clicked "SRT" ─────────
interface SrtRelayStartFormProps {
  loading: boolean;
  onStart: (srtPort: number, passphrase?: string) => Promise<void>;
  onCancel: () => void;
}

const SrtRelayStartForm: React.FC<SrtRelayStartFormProps> = ({ loading, onStart, onCancel }) => {
  const [portInput, setPortInput] = useState(DEFAULT_SRT_PORT);
  const [passphrase, setPassphrase] = useState('');

  const handleStart = () => {
    const port = parseInt(portInput, 10);
    if (isNaN(port) || port < 1 || port > 65535) return;
    onStart(port, passphrase.trim() || undefined);
  };

  return (
    <div className="mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
      <div className="d-flex align-items-center gap-2 mb-2">
        <InputGroup size="sm" style={{ maxWidth: 160 }}>
          <InputGroup.Text className="text-muted" style={{ fontSize: '0.75rem' }}>Port</InputGroup.Text>
          <Form.Control
            type="number"
            value={portInput}
            onChange={e => setPortInput(e.target.value)}
            min={1}
            max={65535}
            placeholder={DEFAULT_SRT_PORT}
          />
        </InputGroup>
        <Button variant="outline-secondary" size="sm" onClick={onCancel}>
          <i className="bi bi-x"></i>
        </Button>
      </div>
      <InputGroup size="sm" className="mb-2">
        <InputGroup.Text className="text-muted" style={{ fontSize: '0.75rem' }}>
          <i className="bi bi-lock me-1"></i>Passphrase
        </InputGroup.Text>
        <Form.Control
          type="password"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          placeholder="auto-generate if empty"
          className="font-monospace"
          style={{ fontSize: '0.75rem' }}
        />
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setPassphrase(generateSecret(SRT_PASSPHRASE_LEN))}
          title="Generate passphrase"
        >
          <i className="bi bi-arrow-clockwise"></i>
        </Button>
      </InputGroup>
      <Button variant="success" size="sm" onClick={handleStart} disabled={loading}>
        {loading
          ? <><i className="bi bi-hourglass-split me-1"></i>Starting…</>
          : <><i className="bi bi-play-fill me-1"></i>Start SRT Relay</>}
      </Button>
    </div>
  );
};

// ── Combined panel: orchestrates which view is shown ─────────────────────
interface SrtRelayPanelProps {
  host: string;
  relay: RistRelay | null;
  showQrCodes: boolean;
  /** True while the form is open and no relay is running. Controlled by parent
   *  so the parent's action button can toggle it. */
  startFormOpen: boolean;
  onCloseStartForm: () => void;
  onStartRelay: (srtPort: number, passphrase?: string) => Promise<void>;
}

export const SrtRelayPanel: React.FC<SrtRelayPanelProps> = ({
  host, relay, showQrCodes, startFormOpen, onCloseStartForm, onStartRelay,
}) => {
  const [loading, setLoading] = useState(false);

  const handleStart = async (port: number, passphrase?: string) => {
    setLoading(true);
    try {
      await onStartRelay(port, passphrase);
      onCloseStartForm();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err?.message ?? 'Failed to start relay');
    } finally {
      setLoading(false);
    }
  };

  if (relay) {
    return <SrtRelayDisplay host={host} relay={relay} showQrCodes={showQrCodes} />;
  }
  if (startFormOpen) {
    return <SrtRelayStartForm loading={loading} onStart={handleStart} onCancel={onCloseStartForm} />;
  }
  return null;
};

import React, { useState } from 'react';
import { Card, Badge, Button, OverlayTrigger, Tooltip, Form, InputGroup } from 'react-bootstrap';
import { RistReceiver } from '../../types/rist-receiver.types';

interface ReceiverCardProps {
  receiver: RistReceiver;
  serverHost?: string;
  onDelete: (id: string) => void;
  onStartRelay: (id: string, srtPort: number) => Promise<void>;
  onStopRelay: (id: string) => Promise<void>;
}

function fallbackCopy(text: string, done: () => void) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); done(); } catch {}
  document.body.removeChild(el);
}

function statusVariant(status: RistReceiver['status']): string {
  switch (status) {
    case 'running':  return 'success';
    case 'starting': return 'warning';
    case 'error':    return 'danger';
    default:         return 'secondary';
  }
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  };
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{copied ? 'Copied!' : 'Copy'}</Tooltip>}>
      <Button variant="link" size="sm" className="p-0 ms-1 text-muted" onClick={handleCopy} style={{ lineHeight: 1 }}>
        <i className={`bi bi-${copied ? 'check2' : 'copy'}`} style={{ fontSize: '0.7rem' }}></i>
      </Button>
    </OverlayTrigger>
  );
};

export const ReceiverCard: React.FC<ReceiverCardProps> = ({ receiver, serverHost, onDelete, onStartRelay, onStopRelay }) => {
  const host = serverHost || 'localhost';
  const ristInputUrl = `rist://${host}:${receiver.listenPort}`;
  const [relayLoading, setRelayLoading] = useState(false);
  const [srtPortInput, setSrtPortInput] = useState('5002');
  const [showRelayInput, setShowRelayInput] = useState(false);

  const relay = receiver.relay;
  const srtPullUrl = relay ? `srt://${host}:${relay.srtPort}` : null;

  const handleStartRelay = async () => {
    const port = parseInt(srtPortInput, 10);
    if (isNaN(port) || port < 1 || port > 65535) return;
    setRelayLoading(true);
    try {
      await onStartRelay(receiver.id, port);
      setShowRelayInput(false);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? err?.message ?? 'Failed to start relay');
    } finally {
      setRelayLoading(false);
    }
  };

  const handleStopRelay = async () => {
    setRelayLoading(true);
    try {
      await onStopRelay(receiver.id);
    } finally {
      setRelayLoading(false);
    }
  };

  return (
    <Card className="mb-2">
      <Card.Body className="py-2 px-3">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Header */}
            <div className="d-flex align-items-center gap-2 mb-1">
              <i className="bi bi-hdd-network text-info"></i>
              <span className="fw-medium text-truncate">{receiver.name}</span>
              <Badge bg={statusVariant(receiver.status)} className="text-capitalize">
                {receiver.status}
              </Badge>
            </div>

            {/* URLs */}
            <div className="small">
              <div className="d-flex align-items-center gap-1 mb-1">
                <span className="text-muted" style={{ minWidth: 90 }}>
                  <i className="bi bi-broadcast me-1 text-info opacity-75"></i>
                  RIST Input
                </span>
                <code className="text-info small">{ristInputUrl}</code>
                <CopyButton text={ristInputUrl} />
              </div>
              <div className="d-flex align-items-center gap-1 mb-1">
                <span className="text-muted" style={{ minWidth: 90 }}>
                  <i className="bi bi-arrow-right me-1 opacity-75"></i>
                  UDP Output
                </span>
                <code className="text-secondary small">{receiver.outputUrl}</code>
                <CopyButton text={receiver.outputUrl} />
              </div>

              {/* SRT Relay */}
              {srtPullUrl && (
                <div className="d-flex align-items-center gap-1">
                  <span className="text-muted" style={{ minWidth: 90 }}>
                    <i className="bi bi-play-circle me-1 text-success opacity-75"></i>
                    SRT Pull
                  </span>
                  <code className="text-success small">{srtPullUrl}</code>
                  <CopyButton text={srtPullUrl} />
                  <Badge bg={relay!.status === 'running' ? 'success' : 'warning'} className="ms-1" style={{ fontSize: '0.6rem' }}>
                    {relay!.status}
                  </Badge>
                </div>
              )}
            </div>

            {/* Relay port input */}
            {showRelayInput && !relay && (
              <div className="mt-2">
                <InputGroup size="sm" style={{ maxWidth: 220 }}>
                  <InputGroup.Text className="text-muted small">SRT Port</InputGroup.Text>
                  <Form.Control
                    type="number"
                    value={srtPortInput}
                    onChange={e => setSrtPortInput(e.target.value)}
                    min={1} max={65535}
                    placeholder="5002"
                  />
                  <Button variant="success" size="sm" onClick={handleStartRelay} disabled={relayLoading}>
                    {relayLoading ? <i className="bi bi-hourglass-split"></i> : 'Start'}
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={() => setShowRelayInput(false)}>
                    <i className="bi bi-x"></i>
                  </Button>
                </InputGroup>
                <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: 2 }}>
                  VLC/OBS → <code>srt://{host}:{srtPortInput || '5002'}</code>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="d-flex flex-column gap-1 flex-shrink-0">
            {!relay && !showRelayInput && (
              <OverlayTrigger placement="left" overlay={<Tooltip>Start SRT relay for remote viewing</Tooltip>}>
                <Button variant="outline-success" size="sm" onClick={() => setShowRelayInput(true)}>
                  <i className="bi bi-cast"></i>
                </Button>
              </OverlayTrigger>
            )}
            {relay && (
              <OverlayTrigger placement="left" overlay={<Tooltip>Stop SRT relay</Tooltip>}>
                <Button variant="outline-warning" size="sm" onClick={handleStopRelay} disabled={relayLoading}>
                  <i className="bi bi-cast"></i>
                </Button>
              </OverlayTrigger>
            )}
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => onDelete(receiver.id)}
              title="Stop receiver"
            >
              <i className="bi bi-stop-circle"></i>
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

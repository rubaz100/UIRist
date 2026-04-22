import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Badge, Button, OverlayTrigger, Tooltip, Form, InputGroup, Collapse } from 'react-bootstrap';
import { QRCodeSVG } from 'qrcode.react';
import { RistReceiver } from '../../types/rist-receiver.types';
import { ristApiService } from '../../services/rist-api.service';
import { useSettings } from '../../contexts/SettingsContext';

interface ReceiverCardProps {
  receiver: RistReceiver;
  serverHost?: string;
  developerMode?: boolean;
  onDelete: (id: string) => void;
  onStartRelay: (id: string, srtPort: number, passphrase?: string) => Promise<void>;
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

export const ReceiverCard: React.FC<ReceiverCardProps> = ({ receiver, serverHost, developerMode, onDelete, onStartRelay, onStopRelay }) => {
  const { showPortInUrls, showQrCodes } = useSettings();
  const host = serverHost || 'localhost';

  const [secretVisible, setSecretVisible] = useState(false);
  const [srtPassphraseVisible, setSrtPassphraseVisible] = useState(false);
  const [ristQrOpen, setRistQrOpen] = useState(false);
  const [srtQrOpen, setSrtQrOpen] = useState(false);
  const [relayLoading, setRelayLoading] = useState(false);
  const [srtPortInput, setSrtPortInput] = useState('5002');
  const [srtPassphraseInput, setSrtPassphraseInput] = useState('');
  const [showRelayInput, setShowRelayInput] = useState(false);

  // Dev mode log state
  const [logsOpen, setLogsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'receiver' | 'relay'>('receiver');
  const [receiverLogs, setReceiverLogs] = useState<string[]>([]);
  const [relayLogs, setRelayLogs] = useState<string[]>([]);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      if (activeTab === 'receiver') {
        const logs = await ristApiService.getReceiverLogs(receiver.id);
        setReceiverLogs(logs);
      } else if (receiver.relay) {
        const logs = await ristApiService.getRelayLogs(receiver.id);
        setRelayLogs(logs);
      }
    } catch {}
  }, [receiver.id, receiver.relay, activeTab]);

  useEffect(() => {
    if (!logsOpen || !developerMode) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, [logsOpen, developerMode, fetchLogs]);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [receiverLogs, relayLogs]);

  const relay = receiver.relay;
  const srtBase = relay ? `srt://${host}:${relay.srtPort}` : null;
  // OBS uses microseconds for latency (2 s = 2 000 000 μs); Input Format: mpegts
  const srtObsUrl = relay?.passphrase
    ? `${srtBase}?passphrase=${relay.passphrase}&latency=2000000`
    : srtBase ? `${srtBase}?latency=2000000` : null;
  const srtObsUrlMasked = relay?.passphrase
    ? `${srtBase}?passphrase=${'•'.repeat(12)}&latency=2000000`
    : srtBase ? `${srtBase}?latency=2000000` : null;
  // VLC ignores URL query params — passphrase must be set in VLC preferences
  const srtVlcUrl = srtBase;

  function generateSrtPassphrase(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => chars[b % chars.length]).join('');
  }

  // RIST input URL — port shown only when setting is enabled
  const ristBase = showPortInUrls ? `rist://${host}:${receiver.listenPort}` : `rist://${host}`;
  const ristInputUrl = receiver.secret ? `${ristBase}?secret=${receiver.secret}` : ristBase;
  const ristInputUrlMasked = receiver.secret ? `${ristBase}?secret=${'•'.repeat(12)}` : ristBase;

  const handleStartRelay = async () => {
    const port = parseInt(srtPortInput, 10);
    if (isNaN(port) || port < 1 || port > 65535) return;
    setRelayLoading(true);
    try {
      await onStartRelay(receiver.id, port, srtPassphraseInput.trim() || undefined);
      setShowRelayInput(false);
      setSrtPassphraseInput('');
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
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-hdd-network text-info"></i>
              <span className="fw-semibold text-truncate">{receiver.name}</span>
              <Badge bg={statusVariant(receiver.status)} className="text-capitalize" style={{ fontSize: '0.65rem' }}>
                {receiver.status}
              </Badge>
              {/* Always show port as subtle hint, independent of URL toggle */}
              <span className="text-muted" style={{ fontSize: '0.65rem' }}>:{receiver.listenPort}</span>
            </div>

            {/* RIST Input URL */}
            <div className="small mb-1">
              <div className="d-flex align-items-center gap-1 flex-wrap">
                <span className="text-muted" style={{ minWidth: 80, fontSize: '0.75rem' }}>
                  <i className="bi bi-broadcast me-1 text-info opacity-75"></i>RIST Input
                </span>
                <code className="text-info" style={{ fontSize: '0.72rem' }}>
                  {secretVisible ? ristInputUrl : ristInputUrlMasked}
                </code>
                <OverlayTrigger placement="top" overlay={<Tooltip>{secretVisible ? 'Hide password' : 'Show password'}</Tooltip>}>
                  <Button variant="link" size="sm" className="p-0 text-muted" style={{ lineHeight: 1 }}
                    onClick={() => setSecretVisible(v => !v)}>
                    <i className={`bi bi-eye${secretVisible ? '-slash' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                  </Button>
                </OverlayTrigger>
                <CopyButton text={ristInputUrl} />
                {showQrCodes && (
                  <OverlayTrigger placement="top" overlay={<Tooltip>{ristQrOpen ? 'QR schließen' : 'QR anzeigen'}</Tooltip>}>
                    <Button variant="link" size="sm" className="p-0 text-muted" style={{ lineHeight: 1 }}
                      onClick={() => setRistQrOpen(v => !v)}>
                      <i className="bi bi-qr-code" style={{ fontSize: '0.7rem' }}></i>
                    </Button>
                  </OverlayTrigger>
                )}
              </div>
              {showQrCodes && (
                <Collapse in={ristQrOpen}>
                  <div className="mt-2 d-flex justify-content-center p-2 rounded" style={{ background: '#fff', display: 'inline-block' }}>
                    <QRCodeSVG value={ristInputUrl} size={160} />
                  </div>
                </Collapse>
              )}
            </div>

            {/* Output URL */}
            <div className="small mb-1">
              <div className="d-flex align-items-center gap-1">
                <span className="text-muted" style={{ minWidth: 80, fontSize: '0.75rem' }}>
                  <i className="bi bi-arrow-right me-1 opacity-75"></i>UDP Out
                </span>
                <code className="text-secondary" style={{ fontSize: '0.72rem' }}>{receiver.outputUrl}</code>
                <CopyButton text={receiver.outputUrl} />
              </div>
            </div>

            {/* SRT Relay — OBS URL */}
            {relay && srtBase && (
              <div className="mt-1 mb-1 p-2 rounded" style={{ background: 'rgba(25,135,84,0.08)', border: '1px solid rgba(25,135,84,0.2)', fontSize: '0.72rem' }}>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="text-success fw-semibold d-flex align-items-center gap-1">
                    <i className="bi bi-play-circle"></i> SRT Pull
                    <Badge bg={relay.status === 'running' ? 'success' : relay.status === 'error' ? 'danger' : 'warning'}
                      className="ms-1" style={{ fontSize: '0.55rem' }}>
                      {relay.status}
                    </Badge>
                  </span>
                  <div className="d-flex align-items-center gap-1">
                    <OverlayTrigger placement="top" overlay={<Tooltip>{srtPassphraseVisible ? 'Hide passphrase' : 'Show passphrase'}</Tooltip>}>
                      <Button variant="link" size="sm" className="p-0 text-muted" style={{ lineHeight: 1 }}
                        onClick={() => setSrtPassphraseVisible(v => !v)}>
                        <i className={`bi bi-eye${srtPassphraseVisible ? '-slash' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                      </Button>
                    </OverlayTrigger>
                    {srtObsUrl && <CopyButton text={srtObsUrl} />}
                    {showQrCodes && (
                      <OverlayTrigger placement="top" overlay={<Tooltip>{srtQrOpen ? 'QR schließen' : 'QR anzeigen'}</Tooltip>}>
                        <Button variant="link" size="sm" className="p-0 text-muted" style={{ lineHeight: 1 }}
                          onClick={() => setSrtQrOpen(v => !v)}>
                          <i className="bi bi-qr-code" style={{ fontSize: '0.7rem' }}></i>
                        </Button>
                      </OverlayTrigger>
                    )}
                  </div>
                </div>

                <div className="d-flex align-items-center gap-1 flex-wrap">
                  <span className="text-muted" style={{ minWidth: 40 }}>
                    <i className="bi bi-camera-video me-1"></i>OBS
                  </span>
                  <code className="text-success" style={{ wordBreak: 'break-all' }}>
                    {srtPassphraseVisible ? srtObsUrl : srtObsUrlMasked}
                  </code>
                </div>
                <div className="text-muted mt-1" style={{ paddingLeft: 44, fontSize: '0.68rem' }}>
                  Input Format: <code>mpegts</code>
                </div>

                {showQrCodes && (
                  <Collapse in={srtQrOpen}>
                    <div className="mt-2 d-flex justify-content-center p-2 rounded" style={{ background: '#fff' }}>
                      {srtObsUrl && <QRCodeSVG value={srtObsUrl} size={160} />}
                    </div>
                  </Collapse>
                )}
              </div>
            )}

            {/* Relay start form */}
            {showRelayInput && !relay && (
              <div className="mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <InputGroup size="sm" style={{ maxWidth: 160 }}>
                    <InputGroup.Text className="text-muted" style={{ fontSize: '0.75rem' }}>Port</InputGroup.Text>
                    <Form.Control
                      type="number"
                      value={srtPortInput}
                      onChange={e => setSrtPortInput(e.target.value)}
                      min={1} max={65535}
                      placeholder="5002"
                    />
                  </InputGroup>
                  <Button variant="outline-secondary" size="sm" onClick={() => setShowRelayInput(false)}>
                    <i className="bi bi-x"></i>
                  </Button>
                </div>
                <InputGroup size="sm" className="mb-2">
                  <InputGroup.Text className="text-muted" style={{ fontSize: '0.75rem' }}>
                    <i className="bi bi-lock me-1"></i>Passphrase
                  </InputGroup.Text>
                  <Form.Control
                    type="password"
                    value={srtPassphraseInput}
                    onChange={e => setSrtPassphraseInput(e.target.value)}
                    placeholder="auto-generate if empty"
                    className="font-monospace"
                    style={{ fontSize: '0.75rem' }}
                  />
                  <Button
                    variant="outline-secondary" size="sm"
                    onClick={() => setSrtPassphraseInput(generateSrtPassphrase())}
                    title="Generate passphrase"
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                  </Button>
                </InputGroup>
                <Button variant="success" size="sm" onClick={handleStartRelay} disabled={relayLoading}>
                  {relayLoading ? <><i className="bi bi-hourglass-split me-1"></i>Starting…</> : <><i className="bi bi-play-fill me-1"></i>Start SRT Relay</>}
                </Button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="d-flex flex-column gap-1 flex-shrink-0">
            {!relay && !showRelayInput && (
              <Button variant="outline-success" size="sm" onClick={() => setShowRelayInput(true)} title="Start SRT relay for VLC/OBS">
                <i className="bi bi-cast me-1"></i>SRT
              </Button>
            )}
            {relay && (
              <Button variant="outline-warning" size="sm" onClick={handleStopRelay} disabled={relayLoading} title="Stop SRT relay">
                <i className="bi bi-cast me-1"></i>Stop
              </Button>
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

        {/* Developer Mode Log Panel */}
        {developerMode && (
          <div className="mt-2 border-top pt-2">
            <Button
              variant="link"
              size="sm"
              className="p-0 text-muted text-decoration-none d-flex align-items-center gap-1"
              onClick={() => setLogsOpen(o => !o)}
            >
              <i className="bi bi-terminal" style={{ fontSize: '0.75rem' }}></i>
              <span style={{ fontSize: '0.75rem' }}>Logs</span>
              <i className={`bi bi-chevron-${logsOpen ? 'up' : 'down'}`} style={{ fontSize: '0.65rem' }}></i>
            </Button>
            <Collapse in={logsOpen}>
              <div>
                <div className="d-flex gap-2 mt-1 mb-1">
                  <button
                    className={`btn btn-link btn-sm p-0 text-decoration-none ${activeTab === 'receiver' ? 'text-info' : 'text-muted'}`}
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => setActiveTab('receiver')}
                  >ristreceiver</button>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>|</span>
                  <button
                    className={`btn btn-link btn-sm p-0 text-decoration-none ${activeTab === 'relay' ? 'text-success' : 'text-muted'}`}
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => setActiveTab('relay')}
                    disabled={!receiver.relay}
                  >srt relay</button>
                </div>
                <div
                  ref={logBoxRef}
                  style={{
                    background: '#0d0d0d',
                    borderRadius: 4,
                    padding: '6px 8px',
                    maxHeight: 180,
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.65rem',
                    lineHeight: 1.5,
                    color: '#ccc',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {(activeTab === 'receiver' ? receiverLogs : relayLogs).length === 0
                    ? <span className="text-muted">No logs yet…</span>
                    : (activeTab === 'receiver' ? receiverLogs : relayLogs).map((line, i) => (
                        <div key={i} style={{ color: line.includes('ERROR') ? '#f88' : line.includes('WARNING') ? '#fa8' : '#ccc' }}>
                          {line}
                        </div>
                      ))
                  }
                </div>
              </div>
            </Collapse>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

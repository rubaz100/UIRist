import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Badge, Button, OverlayTrigger, Tooltip, Form, InputGroup, Collapse } from 'react-bootstrap';
import { RistReceiver } from '../../types/rist-receiver.types';
import { ristApiService } from '../../services/rist-api.service';

interface ReceiverCardProps {
  receiver: RistReceiver;
  serverHost?: string;
  developerMode?: boolean;
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

export const ReceiverCard: React.FC<ReceiverCardProps> = ({ receiver, serverHost, developerMode, onDelete, onStartRelay, onStopRelay }) => {
  const host = serverHost || 'localhost';
  const ristInputUrl = `rist://${host}:${receiver.listenPort}`;
  const [relayLoading, setRelayLoading] = useState(false);
  const [srtPortInput, setSrtPortInput] = useState('5002');
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [receiverLogs, relayLogs]);

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
                  <Badge
                    bg={relay!.status === 'running' ? 'success' : relay!.status === 'error' ? 'danger' : 'warning'}
                    className="ms-1"
                    style={{ fontSize: '0.6rem' }}
                  >
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
                {/* Tab switcher */}
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

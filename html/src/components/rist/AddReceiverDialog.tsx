import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { CreateReceiverPayload } from '../../services/rist-api.service';
import { ristApiService } from '../../services/rist-api.service';

interface AddReceiverDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateReceiverPayload) => Promise<void>;
  apiKey?: string;
  defaultOutputHost?: string;
}

type PortStatus = 'idle' | 'checking' | 'available' | 'reserved' | 'used' | 'invalid';

function generateSecret(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => chars[b % chars.length]).join('');
}

export const AddReceiverDialog: React.FC<AddReceiverDialogProps> = ({ open, onClose, onCreate, apiKey = '' }) => {
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [listenPort, setListenPort] = useState('5005');
  const [outputUrl, setOutputUrl] = useState('udp://127.0.0.1:5001');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [portStatus, setPortStatus] = useState<PortStatus>('idle');

  const checkPort = useCallback(async (portStr: string) => {
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      setPortStatus('invalid');
      return;
    }
    setPortStatus('checking');
    try {
      ristApiService.setApiKey(apiKey);
      const result = await ristApiService.checkPort(port);
      if (result.reserved) setPortStatus('reserved');
      else if (result.usedByReceiver) setPortStatus('used');
      else if (result.available) setPortStatus('available');
      else setPortStatus('used');
    } catch {
      setPortStatus('idle');
    }
  }, [apiKey]);

  useEffect(() => {
    if (!open) return;
    setSecret(generateSecret());
    setOutputUrl('udp://127.0.0.1:5001');
    setShowAdvanced(false);
    const timer = setTimeout(() => checkPort(listenPort), 400);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => checkPort(listenPort), 400);
    return () => clearTimeout(timer);
  }, [listenPort, checkPort]);

  const handleClose = () => {
    setName(''); setListenPort('5005'); setOutputUrl('udp://127.0.0.1:5001');
    setSecret(''); setShowSecret(false); setShowAdvanced(false);
    setError(null); setPortStatus('idle');
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Stream name is required.');
      return;
    }
    if (!secret.trim() || secret.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    const port = parseInt(listenPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      setError('Listen port must be a number between 1 and 65535.');
      return;
    }
    if (!outputUrl.trim()) {
      setError('Output URL is required.');
      return;
    }
    if (portStatus === 'reserved') {
      setError(`Port ${port} is reserved (used by system or RISTMonitor itself).`);
      return;
    }
    if (portStatus === 'used') {
      setError(`Port ${port} is already in use by another receiver.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onCreate({ name: name.trim(), listenPort: port, outputUrl: outputUrl.trim(), secret: secret.trim() });
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to start receiver.');
    } finally {
      setLoading(false);
    }
  };

  const portFeedback = () => {
    switch (portStatus) {
      case 'checking':  return <Form.Text className="text-muted">Checking…</Form.Text>;
      case 'available': return <Form.Text className="text-success"><i className="bi bi-check-circle me-1"></i>Available</Form.Text>;
      case 'reserved':  return <Form.Text className="text-danger"><i className="bi bi-slash-circle me-1"></i>Reserved</Form.Text>;
      case 'used':      return <Form.Text className="text-danger"><i className="bi bi-x-circle me-1"></i>In use</Form.Text>;
      case 'invalid':   return <Form.Text className="text-warning">1–65535</Form.Text>;
      default:          return <Form.Text className="text-muted">UDP port for incoming RIST stream</Form.Text>;
    }
  };

  const blocked = portStatus === 'reserved' || portStatus === 'used';

  return (
    <Modal show={open} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title><i className="bi bi-diagram-3 me-2"></i>Add RIST Receiver</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        <Form>

          {/* Stream name */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Stream Name <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. encoder-main"
              autoFocus
            />
            <Form.Text className="text-muted">
              Unique identifier for this stream.
            </Form.Text>
          </Form.Group>

          {/* Password */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              <i className="bi bi-lock me-1 text-warning"></i>Password (PSK)
            </Form.Label>
            <InputGroup>
              <Form.Control
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={e => setSecret(e.target.value)}
                placeholder="min. 8 characters"
                className="font-monospace"
              />
              <Button
                variant="outline-secondary"
                onClick={() => setShowSecret(s => !s)}
                title={showSecret ? 'Hide' : 'Show'}
              >
                <i className={`bi bi-eye${showSecret ? '-slash' : ''}`}></i>
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setSecret(generateSecret())}
                title="Generate new password"
              >
                <i className="bi bi-arrow-clockwise"></i>
              </Button>
            </InputGroup>
            <Form.Text className="text-muted">
              <i className="bi bi-shield-check me-1 text-success"></i>
              Required by sender (OBS, vMix, ffmpeg) as <code>?secret=…</code> in the RIST URL.
            </Form.Text>
          </Form.Group>

          {/* Advanced toggle */}
          <div className="mb-2">
            <Button
              variant="link"
              size="sm"
              className="p-0 text-muted text-decoration-none d-flex align-items-center gap-1"
              onClick={() => setShowAdvanced(a => !a)}
            >
              <i className={`bi bi-chevron-${showAdvanced ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
              <span style={{ fontSize: '0.8rem' }}>Advanced</span>
            </Button>
          </div>

          {showAdvanced && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Listen Port (UDP)</Form.Label>
                <Form.Control
                  type="number"
                  value={listenPort}
                  onChange={e => setListenPort(e.target.value)}
                  placeholder="5005"
                  min={1} max={65535}
                  isValid={portStatus === 'available'}
                  isInvalid={portStatus === 'reserved' || portStatus === 'used' || portStatus === 'invalid'}
                  style={{ maxWidth: 140 }}
                />
                {portFeedback()}
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Output URL</Form.Label>
                <Form.Control
                  type="text"
                  value={outputUrl}
                  onChange={e => setOutputUrl(e.target.value)}
                  placeholder="udp://127.0.0.1:5001"
                />
                <Form.Text className="text-muted">
                  <code>udp://HOST:PORT</code> or <code>rtp://HOST:PORT</code> — decoded stream destination.
                </Form.Text>
              </Form.Group>
            </>
          )}

        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || blocked}>
          {loading ? 'Starting…' : 'Start Receiver'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

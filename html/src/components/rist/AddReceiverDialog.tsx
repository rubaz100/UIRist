import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { CreateReceiverPayload } from '../../services/rist-api.service';
import { ristApiService } from '../../services/rist-api.service';

interface AddReceiverDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateReceiverPayload) => Promise<void>;
  apiKey?: string;
  defaultOutputHost?: string;
}

type PortStatus = 'idle' | 'checking' | 'available' | 'reserved' | 'used' | 'out-of-range' | 'invalid';

export const AddReceiverDialog: React.FC<AddReceiverDialogProps> = ({ open, onClose, onCreate, apiKey = '', defaultOutputHost = '127.0.0.1' }) => {
  const [name, setName] = useState('');
  const [listenPort, setListenPort] = useState('5005');
  const [outputUrl, setOutputUrl] = useState(`udp://${defaultOutputHost}:5001`);
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
      else if (result.outOfRange) setPortStatus('out-of-range');
      else if (result.available) setPortStatus('available');
      else setPortStatus('used');
    } catch {
      setPortStatus('idle'); // API unreachable — allow submit, server will validate
    }
  }, [apiKey]);

  useEffect(() => {
    if (!open) return;
    setOutputUrl(`udp://${defaultOutputHost}:5001`);
    const timer = setTimeout(() => checkPort(listenPort), 400);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => checkPort(listenPort), 400);
    return () => clearTimeout(timer);
  }, [listenPort, checkPort]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setName(''); setListenPort('5005'); setOutputUrl(`udp://${defaultOutputHost}:5001`);
    setError(null); setPortStatus('idle');
    onClose();
  };

  const handleSubmit = async () => {
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
      setError(`Port ${port} is reserved (used by system or UIRist itself).`);
      return;
    }
    if (portStatus === 'used') {
      setError(`Port ${port} is already in use by another receiver.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onCreate({ name: name.trim() || undefined, listenPort: port, outputUrl: outputUrl.trim() });
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to start receiver.');
    } finally {
      setLoading(false);
    }
  };

  const portFeedback = () => {
    switch (portStatus) {
      case 'checking':     return <Form.Text className="text-muted">Checking availability…</Form.Text>;
      case 'available':    return <Form.Text className="text-success"><i className="bi bi-check-circle me-1"></i>Port is available</Form.Text>;
      case 'reserved':     return <Form.Text className="text-danger"><i className="bi bi-slash-circle me-1"></i>Reserved — used by system or UIRist</Form.Text>;
      case 'used':         return <Form.Text className="text-danger"><i className="bi bi-x-circle me-1"></i>Already in use by another receiver</Form.Text>;
      case 'out-of-range': return <Form.Text className="text-warning"><i className="bi bi-exclamation-triangle me-1"></i>Outside exposed Docker range (5005–5020) — port won't be reachable</Form.Text>;
      case 'invalid':      return <Form.Text className="text-warning">Enter a valid port (1–65535)</Form.Text>;
      default:             return <Form.Text className="text-muted">RIST streams will be received on this UDP port.</Form.Text>;
    }
  };

  const blocked = portStatus === 'reserved' || portStatus === 'used' || portStatus === 'out-of-range';

  return (
    <Modal show={open} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title><i className="bi bi-diagram-3 me-2"></i>Add RIST Receiver</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Name <span className="text-muted">(optional)</span></Form.Label>
            <Form.Control type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. encoder-main" />
          </Form.Group>
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
              Where to forward the decoded stream. Use <code>host.docker.internal</code> to reach the host (e.g. <code>udp://host.docker.internal:5001</code>).
            </Form.Text>
          </Form.Group>
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

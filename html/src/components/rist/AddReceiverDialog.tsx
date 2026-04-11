import React, { useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { CreateReceiverPayload } from '../../services/rist-api.service';

interface AddReceiverDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateReceiverPayload) => Promise<void>;
}

export const AddReceiverDialog: React.FC<AddReceiverDialogProps> = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [listenPort, setListenPort] = useState('5000');
  const [outputUrl, setOutputUrl] = useState('udp://127.0.0.1:5001');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setName('');
    setListenPort('5000');
    setOutputUrl('udp://127.0.0.1:5001');
    setError(null);
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

  return (
    <Modal show={open} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-diagram-3 me-2"></i>
          Add RIST Receiver
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Name <span className="text-muted">(optional)</span></Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. encoder-main"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Listen Port (UDP)</Form.Label>
            <Form.Control
              type="number"
              value={listenPort}
              onChange={e => setListenPort(e.target.value)}
              placeholder="5000"
              min={1}
              max={65535}
            />
            <Form.Text className="text-muted">
              RIST streams will be received on this UDP port.
            </Form.Text>
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
              Where to forward the decoded stream (e.g. <code>udp://127.0.0.1:5001</code>).
            </Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Starting…' : 'Start Receiver'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

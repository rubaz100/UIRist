import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, InputGroup, Badge } from 'react-bootstrap';
import { RistReceiver } from '../../types/rist-receiver.types';
import { ristApiService } from '../../services/rist-api.service';

interface EditReceiverDialogProps {
  open: boolean;
  receiver: RistReceiver | null;
  onClose: () => void;
  onUpdate: (id: string, payload: any) => Promise<RistReceiver | void>;
  apiKey?: string;
}

function generateSecret(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => chars[b % chars.length]).join('');
}

export const EditReceiverDialog: React.FC<EditReceiverDialogProps> = ({ open, receiver, onClose, onUpdate, apiKey = '' }) => {
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [outputUrl, setOutputUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !receiver) return;
    setName(receiver.name);
    setSecret(receiver.secret);
    setOutputUrl(receiver.outputUrl);
    setShowSecret(false);
    setShowAdvanced(false);
    setError(null);
    setWarning(null);
  }, [open, receiver]);

  const handleClose = () => {
    setName('');
    setSecret('');
    setOutputUrl('');
    setShowSecret(false);
    setShowAdvanced(false);
    setError(null);
    setWarning(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!receiver) return;

    if (!name.trim()) {
      setError('Stream name is required.');
      return;
    }
    if (!secret.trim() || secret.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!outputUrl.trim()) {
      setError('Output URL is required.');
      return;
    }

    const updates: any = {};

    // Only include changed fields
    if (name.trim() !== receiver.name) {
      updates.name = name.trim();
    }
    if (secret.trim() !== receiver.secret) {
      updates.secret = secret.trim();
    }
    if (outputUrl.trim() !== receiver.outputUrl) {
      updates.outputUrl = outputUrl.trim();
    }

    // If nothing changed, just close
    if (Object.keys(updates).length === 0) {
      handleClose();
      return;
    }

    // Warn if secret or outputUrl changed (requires restart)
    if (updates.secret || updates.outputUrl) {
      setWarning('Changing password or output URL will restart the receiver.');
    }

    setError(null);
    setLoading(true);
    try {
      await onUpdate(receiver.id, updates);
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to update receiver.');
    } finally {
      setLoading(false);
    }
  };

  if (!receiver) return null;

  return (
    <Modal show={open} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-pencil me-2"></i>Edit RIST Receiver
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        {warning && <Alert variant="warning" className="py-2"><i className="bi bi-exclamation-circle me-1"></i>{warning}</Alert>}
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
              {secret !== receiver.secret && <Badge bg="warning" className="ms-2">Changed</Badge>}
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
                  value={receiver.listenPort}
                  disabled
                  title="Cannot change port while receiver is running. Delete and recreate to change."
                  style={{ maxWidth: 140 }}
                />
                <Form.Text className="text-muted">
                  <i className="bi bi-lock me-1"></i>Fixed while running. Delete and recreate to change port.
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>
                  Output URL
                  {outputUrl !== receiver.outputUrl && <Badge bg="warning" className="ms-2">Changed</Badge>}
                </Form.Label>
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
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : 'Save Changes'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

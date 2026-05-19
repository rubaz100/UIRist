import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { CreateReceiverPayload } from '../../types';
import { ristApiService } from '../../services/rist-api.service';
import { generateSecret } from '../../utils/passphrase';
import { ReceiverFormFields, PortStatus } from './ReceiverFormFields';

interface AddReceiverDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateReceiverPayload) => Promise<void>;
  apiKey?: string;
  defaultOutputHost?: string;
}

const DEFAULT_PORT = '5005';
const DEFAULT_OUTPUT = 'udp://127.0.0.1:5001';
const PORT_CHECK_DEBOUNCE_MS = 400;
const SECRET_MIN = 8;

export const AddReceiverDialog: React.FC<AddReceiverDialogProps> = ({ open, onClose, onCreate, apiKey = '' }) => {
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [listenPort, setListenPort] = useState(DEFAULT_PORT);
  const [outputUrl, setOutputUrl] = useState(DEFAULT_OUTPUT);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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

  // Reset on open + initial port check
  useEffect(() => {
    if (!open) return;
    setSecret(generateSecret());
    setOutputUrl(DEFAULT_OUTPUT);
    setAdvancedOpen(false);
    const timer = setTimeout(() => checkPort(listenPort), PORT_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check port whenever it changes (debounced)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => checkPort(listenPort), PORT_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, listenPort, checkPort]);

  const handleClose = () => {
    setName('');
    setListenPort(DEFAULT_PORT);
    setOutputUrl(DEFAULT_OUTPUT);
    setSecret('');
    setAdvancedOpen(false);
    setError(null);
    setPortStatus('idle');
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) return setError('Stream name is required.');
    if (!secret.trim() || secret.trim().length < SECRET_MIN) return setError(`Password must be at least ${SECRET_MIN} characters.`);
    const port = parseInt(listenPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) return setError('Listen port must be a number between 1 and 65535.');
    if (!outputUrl.trim()) return setError('Output URL is required.');
    if (portStatus === 'reserved') return setError(`Port ${port} is reserved (used by system or RISTMonitor itself).`);
    if (portStatus === 'used') return setError(`Port ${port} is already in use by another receiver.`);

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

  const blocked = portStatus === 'reserved' || portStatus === 'used';

  return (
    <Modal show={open} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title><i className="bi bi-diagram-3 me-2"></i>Add RIST Receiver</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        <Form>
          <ReceiverFormFields
            name={name} onNameChange={setName}
            secret={secret} onSecretChange={setSecret}
            outputUrl={outputUrl} onOutputUrlChange={setOutputUrl}
            listenPort={listenPort} onListenPortChange={setListenPort}
            advancedOpen={advancedOpen} onAdvancedToggle={() => setAdvancedOpen(a => !a)}
            portStatus={portStatus}
            autoFocusName
          />
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

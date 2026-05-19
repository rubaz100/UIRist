import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { RistReceiver } from '../../types';
import { ReceiverFormFields } from './ReceiverFormFields';

interface EditReceiverDialogProps {
  open: boolean;
  receiver: RistReceiver | null;
  onClose: () => void;
  onUpdate: (id: string, payload: any) => Promise<RistReceiver | void>;
  apiKey?: string;
}

const SECRET_MIN = 8;

export const EditReceiverDialog: React.FC<EditReceiverDialogProps> = ({ open, receiver, onClose, onUpdate }) => {
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Hydrate from the receiver each time the dialog opens
  useEffect(() => {
    if (!open || !receiver) return;
    setName(receiver.name);
    setSecret(receiver.secret);
    setOutputUrl(receiver.outputUrl);
    setAdvancedOpen(false);
    setError(null);
    setWarning(null);
  }, [open, receiver]);

  const handleClose = () => {
    setName('');
    setSecret('');
    setOutputUrl('');
    setAdvancedOpen(false);
    setError(null);
    setWarning(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!receiver) return;

    if (!name.trim()) return setError('Stream name is required.');
    if (!secret.trim() || secret.trim().length < SECRET_MIN) return setError(`Password must be at least ${SECRET_MIN} characters.`);
    if (!outputUrl.trim()) return setError('Output URL is required.');

    // Build a diff-only update payload
    const updates: any = {};
    if (name.trim() !== receiver.name) updates.name = name.trim();
    if (secret.trim() !== receiver.secret) updates.secret = secret.trim();
    if (outputUrl.trim() !== receiver.outputUrl) updates.outputUrl = outputUrl.trim();

    if (Object.keys(updates).length === 0) {
      handleClose();
      return;
    }

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
        {warning && (
          <Alert variant="warning" className="py-2">
            <i className="bi bi-exclamation-circle me-1"></i>{warning}
          </Alert>
        )}
        <Form>
          <ReceiverFormFields
            name={name} onNameChange={setName}
            secret={secret} onSecretChange={setSecret}
            outputUrl={outputUrl} onOutputUrlChange={setOutputUrl}
            listenPort={String(receiver.listenPort)} listenPortLocked
            advancedOpen={advancedOpen} onAdvancedToggle={() => setAdvancedOpen(a => !a)}
            serverValues={{ name: receiver.name, secret: receiver.secret, outputUrl: receiver.outputUrl }}
            autoFocusName
          />
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

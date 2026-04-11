import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import config from '../../config';
import { AdvancedModeToggle, HideField } from '../form';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const { apiKey, setApiKey } = useAuth();
  const { advancedMode, setAdvancedMode, ristApiUrl, setRistApiUrl, ristApiKey, setRistApiKey, ristServerHost, setRistServerHost } = useSettings();
  const [localApiKey, setLocalApiKey] = useState('');
  const [localRistApiUrl, setLocalRistApiUrl] = useState('');
  const [localRistApiKey, setLocalRistApiKey] = useState('');
  const [localRistServerHost, setLocalRistServerHost] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalApiKey(apiKey || '');
      setLocalRistApiUrl(ristApiUrl);
      setLocalRistApiKey(ristApiKey);
      setLocalRistServerHost(ristServerHost);
      setSuccess(false);
    }
  }, [open, apiKey, ristApiUrl, ristApiKey]);

  const handleSave = () => {
    setApiKey(localApiKey);
    setRistApiUrl(localRistApiUrl);
    setRistApiKey(localRistApiKey);
    setRistServerHost(localRistServerHost);
    setSuccess(true);
    setTimeout(() => { onClose(); }, 1000);
  };

  return (
    <Modal show={open} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Settings</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {success && <Alert variant="success" className="mb-3">Settings saved successfully!</Alert>}

        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Server URL</Form.Label>
            <Form.Control type="text" value={config.apiEndpoint} readOnly disabled />
            <Form.Text className="text-muted">
              The server URL is configured at build time or via runtime configuration.
            </Form.Text>
          </Form.Group>

          <HideField
            label="SRT API Key"
            value={localApiKey}
            onChange={setLocalApiKey}
            placeholder="Enter your SRT API key"
            helpText="Your SRT Live Server API key for authentication"
          />

          <hr />

          <Form.Group className="mb-3">
            <Form.Label>RIST API URL</Form.Label>
            <Form.Control
              type="text"
              value={localRistApiUrl}
              onChange={e => setLocalRistApiUrl(e.target.value)}
              placeholder="http://localhost:3001"
            />
            <Form.Text className="text-muted">
              URL of the UIRist API server. Manages ristreceiver processes and flow stats.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>RIST Server Hostname</Form.Label>
            <Form.Control
              type="text"
              value={localRistServerHost}
              onChange={e => setLocalRistServerHost(e.target.value)}
              placeholder="e.g. ingest.bro.rs"
            />
            <Form.Text className="text-muted">
              Hostname shown in RIST input URLs. Defaults to the RIST API URL hostname if empty.
            </Form.Text>
          </Form.Group>

          <HideField
            label="RIST API Key"
            value={localRistApiKey}
            onChange={setLocalRistApiKey}
            placeholder="Enter your RIST API key"
            helpText="The RIST_API_KEY set in your server's .env file"
          />

          <hr />

          <AdvancedModeToggle checked={advancedMode} onChange={setAdvancedMode} />
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
};

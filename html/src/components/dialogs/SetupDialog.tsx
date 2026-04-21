import React, { useState } from 'react';
import { Modal, Form, Button, InputGroup } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

interface SetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SetupDialog: React.FC<SetupDialogProps> = ({ open, onClose }) => {
  const { setApiKey } = useAuth();
  const { ristApiUrl, setRistApiUrl, setRistApiKey, setRistServerHost } = useSettings();

  const [localRistUrl, setLocalRistUrl] = useState(ristApiUrl);
  const [localRistHost, setLocalRistHost] = useState('');
  const [localRistKey, setLocalRistKey] = useState('');
  const [localSrtKey, setLocalSrtKey] = useState('');
  const [showRistKey, setShowRistKey] = useState(false);
  const [showSrtKey, setShowSrtKey] = useState(false);

  const handleSave = () => {
    if (localRistUrl.trim()) setRistApiUrl(localRistUrl.trim());
    if (localRistHost.trim()) setRistServerHost(localRistHost.trim());
    setRistApiKey(localRistKey);
    setApiKey(localSrtKey);
    localStorage.setItem('setup-complete', 'true');
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('setup-complete', 'true');
    onClose();
  };

  return (
    <Modal show={open} onHide={handleSkip} centered backdrop="static">
      <Modal.Header>
        <Modal.Title>
          <i className="bi bi-broadcast me-2 text-info"></i>Welcome to RISTMonitor
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="text-muted small mb-4">
          Configure your server connections to get started. You can change these any time in Settings.
        </p>

        <Form>
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              <i className="bi bi-diagram-3 me-2 text-info"></i>RIST API URL
              <span className="text-danger ms-1">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={localRistUrl}
              onChange={e => setLocalRistUrl(e.target.value)}
              placeholder="http://your-server:3001"
              autoFocus
            />
            <Form.Text className="text-muted">
              URL of the RIST Stats Monitor API server managing RIST receivers.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="fw-semibold">
              <i className="bi bi-hdd-network me-2 text-info"></i>RIST Server Hostname
              <span className="text-muted fw-normal ms-2 small">(optional)</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={localRistHost}
              onChange={e => setLocalRistHost(e.target.value)}
              placeholder="e.g. your-server.example.com"
            />
            <Form.Text className="text-muted">
              Hostname shown in RIST input URLs. Defaults to the RIST API URL hostname.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="fw-semibold">
              <i className="bi bi-key me-2 text-info"></i>RIST API Key
              <span className="text-muted fw-normal ms-2 small">(optional)</span>
            </Form.Label>
            <InputGroup>
              <Form.Control
                type={showRistKey ? 'text' : 'password'}
                value={localRistKey}
                onChange={e => setLocalRistKey(e.target.value)}
                placeholder="Leave empty if auth is disabled"
              />
              <Button variant="outline-secondary" onClick={() => setShowRistKey(v => !v)} tabIndex={-1}>
                <i className={`bi bi-eye${showRistKey ? '-slash' : ''}`}></i>
              </Button>
            </InputGroup>
            <Form.Text className="text-muted">
              Matches <code>RIST_API_KEY</code> in your server's <code>.env</code>.
            </Form.Text>
          </Form.Group>

          <hr className="my-3" />

          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold">
              <i className="bi bi-broadcast me-2 text-primary"></i>SRT API Key
              <span className="text-muted fw-normal ms-2 small">(optional)</span>
            </Form.Label>
            <InputGroup>
              <Form.Control
                type={showSrtKey ? 'text' : 'password'}
                value={localSrtKey}
                onChange={e => setLocalSrtKey(e.target.value)}
                placeholder="Leave empty to skip SRT monitoring"
              />
              <Button variant="outline-secondary" onClick={() => setShowSrtKey(v => !v)} tabIndex={-1}>
                <i className={`bi bi-eye${showSrtKey ? '-slash' : ''}`}></i>
              </Button>
            </InputGroup>
            <Form.Text className="text-muted">
              Found in <code>bbox-config.json</code> → <code>key</code> field.
            </Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer className="justify-content-between">
        <Button variant="link" className="text-muted small p-0" onClick={handleSkip}>
          Skip for now
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!localRistUrl.trim()}>
          <i className="bi bi-check2 me-2"></i>Save &amp; Get Started
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

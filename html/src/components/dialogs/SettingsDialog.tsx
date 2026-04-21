import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, Nav } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import config from '../../config';
import { AdvancedModeToggle, HideField } from '../form';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = 'srt' | 'rist' | 'ui';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const { apiKey, setApiKey } = useAuth();
  const {
    advancedMode, setAdvancedMode,
    developerMode, setDeveloperMode,
    ristApiUrl, setRistApiUrl,
    ristApiKey, setRistApiKey,
    ristServerHost, setRistServerHost,
    flowHistoryTimeout, setFlowHistoryTimeout,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<TabKey>('srt');
  const [localApiKey, setLocalApiKey] = useState('');
  const [localRistApiUrl, setLocalRistApiUrl] = useState('');
  const [localRistApiKey, setLocalRistApiKey] = useState('');
  const [localRistServerHost, setLocalRistServerHost] = useState('');
  const [localFlowHistoryTimeout, setLocalFlowHistoryTimeout] = useState('30');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalApiKey(apiKey || '');
      setLocalRistApiUrl(ristApiUrl);
      setLocalRistApiKey(ristApiKey);
      setLocalRistServerHost(ristServerHost);
      setLocalFlowHistoryTimeout(String(flowHistoryTimeout));
      setSuccess(false);
    }
  }, [open, apiKey, ristApiUrl, ristApiKey, ristServerHost, flowHistoryTimeout]);

  const handleSave = () => {
    setApiKey(localApiKey);
    setRistApiUrl(localRistApiUrl);
    setRistApiKey(localRistApiKey);
    setRistServerHost(localRistServerHost);
    const t = parseInt(localFlowHistoryTimeout, 10);
    setFlowHistoryTimeout(isNaN(t) || t < 0 ? 0 : t);
    setSuccess(true);
    setTimeout(() => { onClose(); }, 1000);
  };

  return (
    <Modal show={open} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-gear me-2 text-muted"></i>Settings
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-0">
        {success && (
          <Alert variant="success" className="mx-3 mt-3 mb-0 py-2">
            <i className="bi bi-check2-circle me-2"></i>Settings saved successfully!
          </Alert>
        )}

        {/* Vertical tab layout */}
        <div className="d-flex" style={{ minHeight: 280 }}>

          {/* Sidebar */}
          <Nav
            variant="pills"
            activeKey={activeTab}
            onSelect={k => setActiveTab((k as TabKey) || 'srt')}
            className="flex-column p-2 pt-3"
            style={{
              width: 110,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              gap: 2,
            }}
          >
            <Nav.Item>
              <Nav.Link eventKey="srt" className="d-flex align-items-center gap-2 px-2 py-2" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-broadcast"></i>
                <span>SRT</span>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="rist" className="d-flex align-items-center gap-2 px-2 py-2" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-hdd-network"></i>
                <span>RIST</span>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="ui" className="d-flex align-items-center gap-2 px-2 py-2" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-sliders"></i>
                <span>UI</span>
              </Nav.Link>
            </Nav.Item>
          </Nav>

          {/* Panel */}
        <Form className="p-3 flex-grow-1">

          {/* ── SRT tab ─────────────────────────────────────────── */}
          {activeTab === 'srt' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label className="text-muted small fw-semibold text-uppercase" style={{ letterSpacing: '0.05em' }}>
                  Server
                </Form.Label>
                <Form.Control type="text" value={config.apiEndpoint} readOnly disabled />
                <Form.Text className="text-muted">
                  Configured at build time or via runtime configuration.
                </Form.Text>
              </Form.Group>

              <HideField
                label="API Key"
                value={localApiKey}
                onChange={setLocalApiKey}
                placeholder="Enter your SRT API key"
                helpText="Your SRT Live Server API key for authentication"
              />
            </>
          )}

          {/* ── RIST tab ─────────────────────────────────────────── */}
          {activeTab === 'rist' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>API URL</Form.Label>
                <Form.Control
                  type="text"
                  value={localRistApiUrl}
                  onChange={e => setLocalRistApiUrl(e.target.value)}
                  placeholder="http://localhost:3001"
                />
                <Form.Text className="text-muted">
                  URL of the RIST Stats Monitor API server that manages ristreceiver processes.
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Server Hostname</Form.Label>
                <Form.Control
                  type="text"
                  value={localRistServerHost}
                  onChange={e => setLocalRistServerHost(e.target.value)}
                  placeholder="e.g. your-server.example.com"
                />
                <Form.Text className="text-muted">
                  Hostname shown in RIST input URLs. Defaults to the API URL hostname if empty.
                </Form.Text>
              </Form.Group>

              <HideField
                label="API Key"
                value={localRistApiKey}
                onChange={setLocalRistApiKey}
                placeholder="Enter your RIST API key"
                helpText="The RIST_API_KEY set in your server's .env file"
              />

              <hr className="my-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />

              <Form.Group>
                <Form.Label>
                  Flow History Timeout
                  <span className="text-muted ms-1 fw-normal">(seconds)</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={localFlowHistoryTimeout}
                  onChange={e => setLocalFlowHistoryTimeout(e.target.value)}
                  placeholder="30"
                  style={{ maxWidth: 120 }}
                />
                <Form.Text className="text-muted">
                  Move a flow to history after this many seconds with no active connections.
                  Set to <code>0</code> to disable.
                </Form.Text>
              </Form.Group>
            </>
          )}

          {/* ── UI tab ─────────────────────────────────────────── */}
          {activeTab === 'ui' && (
            <>
              <AdvancedModeToggle checked={advancedMode} onChange={setAdvancedMode} />

              <Form.Group className="mt-3">
                <Form.Check
                  type="switch"
                  id="developer-mode-switch"
                  label={<><i className="bi bi-terminal me-2 text-warning"></i><strong>Developer Mode</strong></>}
                  checked={developerMode}
                  onChange={e => setDeveloperMode(e.target.checked)}
                />
                <Form.Text className="text-muted">
                  Shows process logs (ristreceiver + SRT relay) directly on the Receiver Card.
                </Form.Text>
              </Form.Group>
            </>
          )}

        </Form>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
};

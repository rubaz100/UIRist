import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, Nav, InputGroup } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import config from '../../config';
import { AdvancedModeToggle, HideField } from '../form';
import { ristApiService, EncryptedEnvelope } from '../../services/rist-api.service';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = 'srt' | 'rist' | 'ui' | 'backup';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const { apiKey, setApiKey } = useAuth();
  const {
    advancedMode, setAdvancedMode,
    developerMode, setDeveloperMode,
    showPortInUrls, setShowPortInUrls,
    showQrCodes, setShowQrCodes,
    ristApiUrl, setRistApiUrl,
    ristApiKey, setRistApiKey,
    ristServerHost, setRistServerHost,
    flowHistoryTimeout, setFlowHistoryTimeout,
    configError, configFile, applyImportedConfig,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<TabKey>('srt');
  const [localApiKey, setLocalApiKey] = useState('');
  const [localRistApiUrl, setLocalRistApiUrl] = useState('');
  const [localRistApiKey, setLocalRistApiKey] = useState('');
  const [localRistServerHost, setLocalRistServerHost] = useState('');
  const [localFlowHistoryTimeout, setLocalFlowHistoryTimeout] = useState('30');
  const [success, setSuccess] = useState(false);

  // Backup tab state
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showExportPw, setShowExportPw] = useState(false);
  const [showImportPw, setShowImportPw] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocalApiKey(apiKey || '');
      setLocalRistApiUrl(ristApiUrl);
      setLocalRistApiKey(ristApiKey);
      setLocalRistServerHost(ristServerHost);
      setLocalFlowHistoryTimeout(String(flowHistoryTimeout));
      setSuccess(false);
      // reset backup state on open
      setExportPassword('');
      setExportPasswordConfirm('');
      setImportPassword('');
      setImportFile(null);
      setBackupError(null);
      setBackupSuccess(null);
    }
  }, [open, apiKey, ristApiUrl, ristApiKey, ristServerHost, flowHistoryTimeout]);

  const handleExport = async () => {
    setBackupError(null);
    setBackupSuccess(null);
    if (!exportPassword || exportPassword.length < 4) {
      setBackupError('Password must be at least 4 characters.');
      return;
    }
    if (exportPassword !== exportPasswordConfirm) {
      setBackupError('Passwords do not match.');
      return;
    }
    setBackupBusy(true);
    try {
      ristApiService.setBaseUrl(ristApiUrl);
      ristApiService.setApiKey(ristApiKey);
      const envelope = await ristApiService.exportConfig(exportPassword);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `ristmonitor-config-${ts}.enc.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupSuccess('Encrypted config downloaded.');
      setExportPassword('');
      setExportPasswordConfirm('');
    } catch (err: any) {
      setBackupError(err?.response?.data?.error ?? err?.message ?? 'Export failed.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImport = async () => {
    setBackupError(null);
    setBackupSuccess(null);
    if (!importFile) {
      setBackupError('Please choose an encrypted config file.');
      return;
    }
    if (!importPassword) {
      setBackupError('Password is required to decrypt.');
      return;
    }
    setBackupBusy(true);
    try {
      const text = await importFile.text();
      let envelope: EncryptedEnvelope;
      try {
        envelope = JSON.parse(text);
      } catch {
        throw new Error('File is not a valid JSON envelope.');
      }
      ristApiService.setBaseUrl(ristApiUrl);
      ristApiService.setApiKey(ristApiKey);
      const res = await ristApiService.importConfig(envelope, importPassword);
      applyImportedConfig(res.config);
      setBackupSuccess('Configuration imported successfully. All settings have been updated.');
      setImportPassword('');
      setImportFile(null);
    } catch (err: any) {
      setBackupError(err?.response?.data?.error ?? err?.message ?? 'Import failed.');
    } finally {
      setBackupBusy(false);
    }
  };

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
            <Nav.Item>
              <Nav.Link eventKey="backup" className="d-flex align-items-center gap-2 px-2 py-2" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-shield-lock"></i>
                <span>Backup</span>
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

              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  id="show-port-switch"
                  label={<><i className="bi bi-123 me-2 text-warning"></i><strong>Port in RIST-URLs anzeigen</strong></>}
                  checked={showPortInUrls}
                  onChange={e => setShowPortInUrls(e.target.checked)}
                />
                <Form.Text className="text-muted">
                  <i className="bi bi-shield-exclamation me-1 text-warning"></i>
                  Zeigt den UDP-Port in der RIST-Eingabe-URL. <strong>Sicherheitshinweis:</strong> Der Port ist ohne PSK-Passwort für jeden offen — stelle sicher, dass jeder Receiver ein Passwort hat.
                </Form.Text>
              </Form.Group>

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

          {/* ── Backup tab ─────────────────────────────────────────── */}
          {activeTab === 'backup' && (
            <div>
              {configError && (
                <Alert variant="danger" className="py-2">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  <strong>Config Load Error:</strong> {configError}
                </Alert>
              )}
              {backupError && (
                <Alert variant="danger" className="py-2" onClose={() => setBackupError(null)} dismissible>
                  <i className="bi bi-exclamation-triangle me-2"></i>{backupError}
                </Alert>
              )}
              {backupSuccess && (
                <Alert variant="success" className="py-2" onClose={() => setBackupSuccess(null)} dismissible>
                  <i className="bi bi-check2-circle me-2"></i>{backupSuccess}
                </Alert>
              )}

              {configFile && (
                <div className="text-muted small mb-3">
                  <i className="bi bi-folder me-1"></i>
                  Server config file: <code>{configFile}</code>
                </div>
              )}

              {/* Export */}
              <div className="mb-4">
                <h6 className="mb-2">
                  <i className="bi bi-download me-2 text-info"></i>Export (Encrypted Backup)
                </h6>
                <p className="small text-muted mb-2">
                  Download your full configuration as an AES-256 encrypted file. Keep the password safe — it cannot be recovered.
                </p>
                <Form.Group className="mb-2">
                  <Form.Label className="small">Password</Form.Label>
                  <InputGroup size="sm">
                    <Form.Control
                      type={showExportPw ? 'text' : 'password'}
                      value={exportPassword}
                      onChange={e => setExportPassword(e.target.value)}
                      placeholder="min. 4 characters"
                      autoComplete="new-password"
                    />
                    <Button variant="outline-secondary" onClick={() => setShowExportPw(s => !s)} title={showExportPw ? 'Hide' : 'Show'}>
                      <i className={`bi bi-eye${showExportPw ? '-slash' : ''}`}></i>
                    </Button>
                  </InputGroup>
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label className="small">Confirm Password</Form.Label>
                  <Form.Control
                    size="sm"
                    type={showExportPw ? 'text' : 'password'}
                    value={exportPasswordConfirm}
                    onChange={e => setExportPasswordConfirm(e.target.value)}
                    placeholder="repeat password"
                    autoComplete="new-password"
                  />
                </Form.Group>
                <Button variant="info" size="sm" onClick={handleExport} disabled={backupBusy}>
                  <i className="bi bi-download me-1"></i>{backupBusy ? 'Exporting…' : 'Download Backup'}
                </Button>
              </div>

              <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />

              {/* Import */}
              <div className="mb-2">
                <h6 className="mb-2">
                  <i className="bi bi-upload me-2 text-warning"></i>Import (Restore Backup)
                </h6>
                <p className="small text-muted mb-2">
                  Upload a previously exported encrypted file. <strong>This will overwrite all current settings.</strong>
                </p>
                <Form.Group className="mb-2">
                  <Form.Label className="small">Encrypted File</Form.Label>
                  <Form.Control
                    size="sm"
                    type="file"
                    accept=".json,application/json"
                    onChange={e => setImportFile((e.target as HTMLInputElement).files?.[0] || null)}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label className="small">Password</Form.Label>
                  <InputGroup size="sm">
                    <Form.Control
                      type={showImportPw ? 'text' : 'password'}
                      value={importPassword}
                      onChange={e => setImportPassword(e.target.value)}
                      placeholder="enter export password"
                      autoComplete="off"
                    />
                    <Button variant="outline-secondary" onClick={() => setShowImportPw(s => !s)} title={showImportPw ? 'Hide' : 'Show'}>
                      <i className={`bi bi-eye${showImportPw ? '-slash' : ''}`}></i>
                    </Button>
                  </InputGroup>
                </Form.Group>
                <Button variant="warning" size="sm" onClick={handleImport} disabled={backupBusy || !importFile}>
                  <i className="bi bi-upload me-1"></i>{backupBusy ? 'Importing…' : 'Restore from Backup'}
                </Button>
              </div>
            </div>
          )}

          {/* ── UI tab ─────────────────────────────────────────── */}
          {activeTab === 'ui' && (
            <>
              <AdvancedModeToggle checked={advancedMode} onChange={setAdvancedMode} />

              <Form.Group className="mt-3">
                <Form.Check
                  type="switch"
                  id="show-qr-switch"
                  label={<><i className="bi bi-qr-code me-2 text-info"></i><strong>QR-Codes anzeigen</strong></>}
                  checked={showQrCodes}
                  onChange={e => setShowQrCodes(e.target.checked)}
                />
                <Form.Text className="text-muted">
                  Zeigt aufklappbare QR-Codes für RIST- und SRT-URLs auf der Receiver-Card.
                </Form.Text>
              </Form.Group>

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

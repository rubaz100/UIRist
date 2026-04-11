import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Navbar, Nav, Button, Alert, Spinner, Card, Collapse } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useSettings, ServiceType } from '../contexts/SettingsContext';
import { apiService } from '../services/api.service';
import { StreamId } from '../types/api.types';
import { PublisherCard } from '../components/publisher';
import { RistFlowCard, AddReceiverDialog, ReceiverCard } from '../components/rist';
import { AddStreamDialog, SettingsDialog } from '../components/dialogs';
import { useRistStats } from '../hooks/useRistStats';
import { useRistReceivers } from '../hooks/useRistReceivers';
import { RefreshTimer } from '../components/ui';

// ── Service selection welcome screen ────────────────────────────────────────
const ServiceSelector: React.FC<{
  onConfirm: (services: ServiceType[]) => void;
  onOpenSettings: () => void;
}> = ({ onConfirm, onOpenSettings }) => {
  const [selected, setSelected] = useState<ServiceType[]>([]);

  const toggle = (s: ServiceType) =>
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  return (
    <Container className="py-5" style={{ maxWidth: 600 }}>
      <div className="text-center mb-5">
        <h2 className="mb-2">Welcome to UIRist</h2>
        <p className="text-muted">What would you like to manage?</p>
      </div>

      <Row className="g-4 mb-4">
        {/* SRT */}
        <Col xs={12} sm={6}>
          <Card
            className={`h-100 text-center selectable-card${selected.includes('srt') ? ' selected' : ''}`}
            onClick={() => toggle('srt')}
            style={{ cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <Card.Body className="py-4">
              <i className={`bi bi-broadcast display-4 mb-3 d-block ${selected.includes('srt') ? 'text-primary' : 'text-muted'}`}></i>
              <h5 className="mb-1">SRT</h5>
              <p className="text-muted small mb-2">Manage SRT Live Server publishers and streams</p>
              {selected.includes('srt') && (
                <span className="badge bg-primary">
                  <i className="bi bi-check2 me-1"></i>Selected
                </span>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* RIST */}
        <Col xs={12} sm={6}>
          <Card
            className={`h-100 text-center selectable-card${selected.includes('rist') ? ' selected' : ''}`}
            onClick={() => toggle('rist')}
            style={{ cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <Card.Body className="py-4">
              <i className={`bi bi-diagram-3 display-4 mb-3 d-block ${selected.includes('rist') ? 'text-info' : 'text-muted'}`}></i>
              <h5 className="mb-1">RIST</h5>
              <p className="text-muted small mb-2">Manage RIST receivers and monitor live flows</p>
              {selected.includes('rist') && (
                <span className="badge bg-info text-dark">
                  <i className="bi bi-check2 me-1"></i>Selected
                </span>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="d-flex flex-column align-items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
          className="px-5"
        >
          Get Started
        </Button>
        <Button variant="link" className="text-muted small" onClick={onOpenSettings}>
          <i className="bi bi-gear me-1"></i>Configure settings first
        </Button>
      </div>
    </Container>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
export const PublishersPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { ristApiUrl, enabledServices, setEnabledServices } = useSettings();

  // ── SRT state ──────────────────────────────────────────────────────────────
  const [streamIds, setStreamIds] = useState<StreamId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [prefillPublisher, setPrefillPublisher] = useState<string | undefined>(undefined);

  // ── RIST state ─────────────────────────────────────────────────────────────
  const srtEnabled = enabledServices.includes('srt');
  const ristEnabled = enabledServices.includes('rist');

  const { flows: ristFlows, loading: ristLoading, error: ristError, secondsUntilUpdate: ristTimer } =
    useRistStats(ristEnabled ? ristApiUrl : '');
  const { receivers, loading: receiversLoading, createReceiver, deleteReceiver, refresh: refreshReceivers } =
    useRistReceivers(ristEnabled ? ristApiUrl : '');
  const [addReceiverOpen, setAddReceiverOpen] = useState(false);
  const [receiversExpanded, setReceiversExpanded] = useState(false);

  // ── SRT helpers ────────────────────────────────────────────────────────────
  const groupedStreamIds = React.useMemo(() => {
    const groups: Record<string, StreamId[]> = {};
    streamIds.forEach(s => {
      if (!groups[s.publisher]) groups[s.publisher] = [];
      groups[s.publisher].push(s);
    });
    return groups;
  }, [streamIds]);

  const fetchStreamIds = useCallback(async () => {
    if (!isAuthenticated || !srtEnabled) { setLoading(false); return; }
    try {
      setError(null);
      const data = await apiService.getStreamIds();
      setStreamIds(data);
    } catch (err: any) {
      setError(err.response?.status === 401
        ? 'Authentication failed. Please check your API key in settings.'
        : 'Failed to fetch stream IDs. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, srtEnabled]);

  useEffect(() => { fetchStreamIds(); }, [isAuthenticated, fetchStreamIds]);

  const handleStreamAdded = (newStreamId: StreamId) => {
    setStreamIds(prev => [...prev, newStreamId]);
    setPrefillPublisher(undefined);
  };

  const handleDeleteStream = async (playerId: string) => {
    try {
      await apiService.deleteStreamId(playerId);
      setStreamIds(prev => prev.filter(s => s.player !== playerId));
    } catch {
      setError('Failed to delete stream. Please try again.');
    }
  };

  const handleAddPlayer = (publisher: string) => {
    setPrefillPublisher(publisher);
    setAddDialogOpen(true);
  };

  const handleCreateReceiver = async (payload: any) => {
    await createReceiver(payload);
    setTimeout(refreshReceivers, 1200);
  };

  // ── No service selected yet → show welcome screen ─────────────────────────
  if (enabledServices.length === 0) {
    return (
      <>
        <Navbar className="navbar-dark sticky-top" expand="lg">
          <Container fluid>
            <Navbar.Brand href="#">
              <i className="bi bi-broadcast me-2"></i>
              UIRist
            </Navbar.Brand>
            <Nav className="ms-auto">
              <Button variant="link" className="nav-link" onClick={() => setSettingsDialogOpen(true)} title="Settings">
                <i className="bi bi-gear"></i>
              </Button>
            </Nav>
          </Container>
        </Navbar>

        <ServiceSelector
          onConfirm={setEnabledServices}
          onOpenSettings={() => setSettingsDialogOpen(true)}
        />

        <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
      </>
    );
  }

  // ── SRT requires API key ───────────────────────────────────────────────────
  const srtNeedsAuth = srtEnabled && !isAuthenticated;

  return (
    <>
      <Navbar className="navbar-dark sticky-top" expand="lg">
        <Container fluid>
          <Navbar.Brand href="#">
            <i className="bi bi-broadcast me-2"></i>
            UIRist
          </Navbar.Brand>
          <Nav className="ms-auto d-flex align-items-center gap-1">
            <Button
              variant="link"
              className="nav-link small text-muted"
              onClick={() => setEnabledServices([])}
              title="Switch services"
            >
              <i className="bi bi-arrow-left-right me-1"></i>
              {enabledServices.map(s => s.toUpperCase()).join(' + ')}
            </Button>
            <Button variant="link" className="nav-link" onClick={() => setSettingsDialogOpen(true)} title="Settings">
              <i className="bi bi-gear"></i>
            </Button>
          </Nav>
        </Container>
      </Navbar>

      <Container className="py-4">
        {srtNeedsAuth && (
          <Alert variant="warning" className="d-flex align-items-center gap-3 mb-4">
            <i className="bi bi-key fs-4"></i>
            <div className="flex-grow-1">
              <strong>SRT API key required</strong>
              <div className="small">Configure your SLS API key in settings to manage SRT streams.</div>
            </div>
            <Button variant="warning" size="sm" onClick={() => setSettingsDialogOpen(true)}>
              <i className="bi bi-gear me-1"></i>Settings
            </Button>
          </Alert>
        )}

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-3">{error}</Alert>
        )}

        <Row className="mb-4 align-items-center g-2">
          <Col>
            <h2 className="mb-1">Streams</h2>
            <p className="text-muted mb-0">
              {srtEnabled && ristEnabled && 'Manage SRT publishers and RIST flows'}
              {srtEnabled && !ristEnabled && 'Manage SRT publishers'}
              {!srtEnabled && ristEnabled && 'Monitor and manage RIST flows'}
            </p>
          </Col>
          {srtEnabled && isAuthenticated && (
            <Col xs="auto">
              <Button variant="primary" onClick={() => { setPrefillPublisher(undefined); setAddDialogOpen(true); }} disabled={loading} className="text-nowrap">
                <i className="bi bi-plus-lg me-2"></i>Add SRT Stream
              </Button>
            </Col>
          )}
        </Row>

        <Row className="g-4">
          {/* ── SRT Publishers ── */}
          {srtEnabled && (
            <Col xs={12} lg={ristEnabled ? 6 : 12}>
              <div className="d-flex align-items-center mb-3">
                <h5 className="mb-0"><i className="bi bi-broadcast me-2 text-primary"></i>SRT Publishers</h5>
              </div>

              {!isAuthenticated ? (
                <Card className="text-center border-warning">
                  <Card.Body className="py-4">
                    <i className="bi bi-key display-6 mb-2 d-block text-warning opacity-75"></i>
                    <h6 className="mb-2">API key required</h6>
                    <p className="text-muted small mb-3">Configure your SLS API key to manage streams.</p>
                    <Button variant="outline-warning" size="sm" onClick={() => setSettingsDialogOpen(true)}>
                      <i className="bi bi-gear me-1"></i>Configure
                    </Button>
                  </Card.Body>
                </Card>
              ) : loading ? (
                <div className="text-center py-5"><Spinner animation="border" role="status"><span className="visually-hidden">Loading…</span></Spinner></div>
              ) : streamIds.length === 0 ? (
                <Card className="text-center">
                  <Card.Body className="py-4">
                    <h6 className="mb-2">No streams configured</h6>
                    <p className="text-muted small mb-3">Add your first stream to get started</p>
                    <Button variant="primary" size="sm" onClick={() => { setPrefillPublisher(undefined); setAddDialogOpen(true); }}>
                      <i className="bi bi-plus-lg me-2"></i>Add Stream
                    </Button>
                  </Card.Body>
                </Card>
              ) : (
                <div>
                  {Object.entries(groupedStreamIds).map(([publisher, ids]) => (
                    <PublisherCard key={publisher} publisherName={publisher} streamIds={ids} onDelete={handleDeleteStream} onAddPlayer={handleAddPlayer} />
                  ))}
                </div>
              )}
            </Col>
          )}

          {/* ── RIST Receivers + Flows ── */}
          {ristEnabled && (
            <Col xs={12} lg={srtEnabled ? 6 : 12}>
              {/* Receivers */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <Button
                    variant="link"
                    className="p-0 text-decoration-none text-light d-flex align-items-center gap-2"
                    onClick={() => setReceiversExpanded(!receiversExpanded)}
                  >
                    <i className="bi bi-hdd-network text-info"></i>
                    <span className="fw-semibold">RIST Receivers</span>
                    <span className="badge bg-secondary">{receivers.length}</span>
                    <i className={`bi bi-chevron-${receiversExpanded ? 'up' : 'down'} small`}></i>
                  </Button>
                  <Button variant="outline-info" size="sm" onClick={() => setAddReceiverOpen(true)}>
                    <i className="bi bi-plus-lg me-1"></i>Add
                  </Button>
                </div>
                <Collapse in={receiversExpanded}>
                  <div>
                    {receiversLoading ? (
                      <div className="text-center py-2"><Spinner animation="border" size="sm" /></div>
                    ) : receivers.length === 0 ? (
                      <p className="text-muted small mb-0">No receivers running. Click Add to start one.</p>
                    ) : (
                      receivers.map(r => <ReceiverCard key={r.id} receiver={r} onDelete={deleteReceiver} />)
                    )}
                  </div>
                </Collapse>
              </div>

              {/* Flows */}
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0"><i className="bi bi-diagram-3 me-2 text-info"></i>RIST Flows</h5>
                {!ristLoading && !ristError && <RefreshTimer secondsUntilUpdate={ristTimer} />}
              </div>

              {ristLoading ? (
                <div className="text-center py-5"><Spinner animation="border" role="status"><span className="visually-hidden">Loading…</span></Spinner></div>
              ) : ristError ? (
                <Alert variant="warning" className="mb-0">
                  <i className="bi bi-exclamation-triangle me-2"></i>{ristError}
                </Alert>
              ) : ristFlows.length === 0 ? (
                <Card className="text-center">
                  <Card.Body className="py-4">
                    <i className="bi bi-diagram-3 display-6 mb-2 d-block opacity-50"></i>
                    <h6 className="mb-1">No active RIST flows</h6>
                    <p className="text-muted small mb-0">Start a receiver above or configure your RIST API URL in Settings.</p>
                  </Card.Body>
                </Card>
              ) : (
                <div>
                  {ristFlows.map(flow => <RistFlowCard key={`${flow.receiverId}-${flow.flowId}`} flow={flow} />)}
                </div>
              )}
            </Col>
          )}
        </Row>
      </Container>

      <AddStreamDialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setPrefillPublisher(undefined); }} onStreamAdded={handleStreamAdded} prefillPublisher={prefillPublisher} />
      <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
      <AddReceiverDialog open={addReceiverOpen} onClose={() => setAddReceiverOpen(false)} onCreate={handleCreateReceiver} />
    </>
  );
};

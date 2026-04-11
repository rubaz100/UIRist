import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Navbar, Nav, Button, Alert, Spinner, Card, Collapse } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiService } from '../services/api.service';
import { StreamId } from '../types/api.types';
import { PublisherCard } from '../components/publisher';
import { RistFlowCard, AddReceiverDialog, ReceiverCard } from '../components/rist';
import { SettingsDialog } from '../components/dialogs';
import { useRistStats } from '../hooks/useRistStats';
import { useRistReceivers } from '../hooks/useRistReceivers';
import { RefreshTimer } from '../components/ui';

export const PublishersPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { ristApiUrl, ristApiKey } = useSettings();

  // ── SRT state ──────────────────────────────────────────────────────────────
  const [streamIds, setStreamIds] = useState<StreamId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // ── RIST state ─────────────────────────────────────────────────────────────
  const ristApiConfigured = ristApiUrl && !ristApiUrl.startsWith('{{') && ristApiUrl.trim() !== '';

  const { flows: ristFlows, loading: ristLoading, error: ristError, secondsUntilUpdate: ristTimer } =
    useRistStats(ristApiConfigured ? ristApiUrl : '', ristApiKey);
  const { receivers, loading: receiversLoading, createReceiver, deleteReceiver, refresh: refreshReceivers } =
    useRistReceivers(ristApiConfigured ? ristApiUrl : '', ristApiKey);
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
    if (!isAuthenticated) { setLoading(false); return; }
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
  }, [isAuthenticated]);

  useEffect(() => { fetchStreamIds(); }, [isAuthenticated, fetchStreamIds]);

  const handleCreateReceiver = async (payload: any) => {
    await createReceiver(payload);
    setTimeout(refreshReceivers, 1200);
  };

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

      <Container className="py-4">
        {!isAuthenticated && (
          <Alert variant="warning" className="d-flex align-items-center gap-3 mb-4">
            <i className="bi bi-key fs-4"></i>
            <div className="flex-grow-1">
              <strong>SRT API key required</strong>
              <div className="small">Configure your SLS API key in settings to monitor SRT streams.</div>
            </div>
            <Button variant="warning" size="sm" onClick={() => setSettingsDialogOpen(true)}>
              <i className="bi bi-gear me-1"></i>Settings
            </Button>
          </Alert>
        )}

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-3">{error}</Alert>
        )}

        <Row className="mb-3 align-items-center">
          <Col>
            <h2 className="mb-1">Streams</h2>
            <p className="text-muted mb-0">Monitor SRT streams and manage RIST flows</p>
          </Col>
        </Row>

        <Row className="g-4">
          {/* ── SRT ── */}
          <Col xs={12} lg={6}>
            <div className="d-flex align-items-center mb-3">
              <h5 className="mb-0"><i className="bi bi-broadcast me-2 text-primary"></i>SRT Publishers</h5>
            </div>

            {!isAuthenticated ? (
              <Card className="text-center border-warning">
                <Card.Body className="py-4">
                  <i className="bi bi-key display-6 mb-2 d-block text-warning opacity-75"></i>
                  <h6 className="mb-2">API key required</h6>
                  <p className="text-muted small mb-3">Configure your SLS API key to monitor streams.</p>
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
                  <i className="bi bi-broadcast display-6 mb-2 d-block opacity-50"></i>
                  <h6 className="mb-2">No active SRT streams</h6>
                  <p className="text-muted small mb-0">Streams are configured on the server.</p>
                </Card.Body>
              </Card>
            ) : (
              <div>
                {Object.entries(groupedStreamIds).map(([publisher, ids]) => (
                  <PublisherCard key={publisher} publisherName={publisher} streamIds={ids} />
                ))}
              </div>
            )}
          </Col>

          {/* ── RIST ── */}
          <Col xs={12} lg={6}>
            {!ristApiConfigured && (
              <Alert variant="warning" className="d-flex align-items-center gap-3 mb-3">
                <i className="bi bi-link-45deg fs-4"></i>
                <div className="flex-grow-1">
                  <strong>RIST API URL required</strong>
                  <div className="small">Configure the URL of the UIRist API server in settings to manage receivers.</div>
                </div>
                <Button variant="warning" size="sm" onClick={() => setSettingsDialogOpen(true)}>
                  <i className="bi bi-gear me-1"></i>Settings
                </Button>
              </Alert>
            )}

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
                <Button variant="outline-info" size="sm" onClick={() => setAddReceiverOpen(true)} disabled={!ristApiConfigured}>
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
                    receivers.map(r => <ReceiverCard key={r.id} receiver={r} serverHost={(() => { try { return new URL(ristApiUrl).hostname; } catch { return 'localhost'; } })()} onDelete={deleteReceiver} />)
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
        </Row>
      </Container>

      <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
      <AddReceiverDialog open={addReceiverOpen} onClose={() => setAddReceiverOpen(false)} onCreate={handleCreateReceiver} apiKey={ristApiKey} />
    </>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Navbar, Nav, Button, Alert, Spinner, Card, Collapse } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiService } from '../services/api.service';
import { StreamId } from '../types/api.types';
import { PublisherCard } from '../components/publisher';
import { RistFlowCard, AddReceiverDialog, ReceiverCard } from '../components/rist';
import { AddStreamDialog, SettingsDialog } from '../components/dialogs';
import { useRistStats } from '../hooks/useRistStats';
import { useRistReceivers } from '../hooks/useRistReceivers';
import { RefreshTimer } from '../components/ui';

export const PublishersPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { ristApiUrl } = useSettings();

  // ── SRT state ──────────────────────────────────────────────────────────────
  const [streamIds, setStreamIds] = useState<StreamId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [prefillPublisher, setPrefillPublisher] = useState<string | undefined>(undefined);

  // ── RIST state ─────────────────────────────────────────────────────────────
  const { flows: ristFlows, loading: ristLoading, error: ristError, secondsUntilUpdate: ristTimer } =
    useRistStats(ristApiUrl);
  const { receivers, loading: receiversLoading, createReceiver, deleteReceiver, refresh: refreshReceivers } =
    useRistReceivers(ristApiUrl);
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

  // ── RIST helpers ───────────────────────────────────────────────────────────
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
            SRT Live Server Management
          </Navbar.Brand>
          <Nav className="ms-auto">
            <Button variant="link" className="nav-link" onClick={() => setSettingsDialogOpen(true)} title="Settings">
              <i className="bi bi-gear"></i>
            </Button>
          </Nav>
        </Container>
      </Navbar>

      <Container className="py-4">
        {!isAuthenticated ? (
          <Card className="text-center">
            <Card.Body className="py-5">
              <h3 className="mb-3">Welcome to SRT Live Server Management</h3>
              <p className="text-muted mb-4">Please configure your API key to get started.</p>
              <Button variant="primary" size="lg" onClick={() => setSettingsDialogOpen(true)}>
                <i className="bi bi-gear me-2"></i>Configure Settings
              </Button>
            </Card.Body>
          </Card>
        ) : (
          <>
            <Row className="mb-4 align-items-center g-2">
              <Col>
                <h2 className="mb-1">Streams</h2>
                <p className="text-muted mb-0">Manage SRT publishers and monitor RIST flows</p>
              </Col>
              <Col xs="auto">
                <Button variant="primary" onClick={() => { setPrefillPublisher(undefined); setAddDialogOpen(true); }} disabled={loading} className="text-nowrap">
                  <i className="bi bi-plus-lg me-2"></i>Add SRT Stream
                </Button>
              </Col>
            </Row>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-3">{error}</Alert>
            )}

            <Row className="g-4">
              {/* ── SRT Publishers ── */}
              <Col xs={12} lg={6}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="mb-0"><i className="bi bi-broadcast me-2 text-primary"></i>SRT Publishers</h5>
                </div>

                {loading ? (
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

              {/* ── RIST Flows + Receivers ── */}
              <Col xs={12} lg={6}>
                {/* Receivers management (collapsible) */}
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
                        receivers.map(r => (
                          <ReceiverCard key={r.id} receiver={r} onDelete={deleteReceiver} />
                        ))
                      )}
                    </div>
                  </Collapse>
                </div>

                {/* Live flows */}
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
          </>
        )}

        <AddStreamDialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setPrefillPublisher(undefined); }} onStreamAdded={handleStreamAdded} prefillPublisher={prefillPublisher} />
        <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
        <AddReceiverDialog open={addReceiverOpen} onClose={() => setAddReceiverOpen(false)} onCreate={handleCreateReceiver} />
      </Container>
    </>
  );
};

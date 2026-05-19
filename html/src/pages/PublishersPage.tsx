import React, { useState } from 'react';
import { Container, Row, Col, Alert, Button } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { CreateReceiverPayload } from '../types';
import { useRistStats } from '../hooks/useRistStats';
import { useRistReceivers } from '../hooks/useRistReceivers';
import { useSrtPublishers } from '../hooks/useSrtPublishers';
import { AppNavbar, ConfigErrorBanner } from '../components/layout';
import { ReceiversList, RistFlowsList, RistFlowHistoryList, AddReceiverDialog } from '../components/rist';
import { SrtPublishersSection } from '../components/srt';
import { SettingsDialog, SetupDialog } from '../components/dialogs';

const SETUP_COMPLETE_KEY = 'setup-complete';
const REFRESH_AFTER_CREATE_MS = 1200;

/**
 * The single dashboard view. Owns the data hooks for SRT + RIST and orchestrates
 * the two-column layout — actual rendering is delegated to section components.
 */
export const PublishersPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const {
    ristApiUrl, ristApiKey, ristServerHost,
    flowHistoryTimeout, ristStatsZeroDelay,
    developerMode, configError,
  } = useSettings();

  // Fallback to URL hostname when no explicit server host is configured —
  // works when the API is on the same machine as the stream sender.
  const resolvedServerHost = ristServerHost || (() => {
    try { return new URL(ristApiUrl).hostname; } catch { return 'localhost'; }
  })();
  const ristApiConfigured = !!ristApiUrl && !ristApiUrl.startsWith('{{') && ristApiUrl.trim() !== '';

  // Dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(() => !localStorage.getItem(SETUP_COMPLETE_KEY));
  const [addReceiverOpen, setAddReceiverOpen] = useState(false);

  // Data hooks
  const { streamIds, loading: srtLoading, error: srtError } = useSrtPublishers(isAuthenticated);
  const ristStatsUrl = ristApiConfigured ? ristApiUrl : '';
  const {
    flows: ristFlows, historyFlows: ristHistoryFlows,
    loading: ristLoading, error: ristError, secondsUntilUpdate: ristTimer,
  } = useRistStats(ristStatsUrl, ristApiKey, flowHistoryTimeout, ristStatsZeroDelay);
  const {
    receivers, loading: receiversLoading,
    createReceiver, updateReceiver, deleteReceiver,
    startRelay, stopRelay, refresh: refreshReceivers,
  } = useRistReceivers(ristStatsUrl, ristApiKey);

  const handleCreateReceiver = async (payload: CreateReceiverPayload) => {
    await createReceiver(payload);
    // Receiver status flips from 'starting' to 'running' after the process
    // signals 'spawn'. Refresh once so the badge reflects the final state.
    setTimeout(refreshReceivers, REFRESH_AFTER_CREATE_MS);
  };

  return (
    <>
      <AppNavbar onOpenSettings={() => setSettingsOpen(true)} />

      <Container className="py-4">
        {srtError && <Alert variant="danger" className="mb-3">{srtError}</Alert>}
        <ConfigErrorBanner error={configError} />

        <Row className="mb-3 align-items-center">
          <Col>
            <h2 className="mb-1">Dashboard</h2>
            <p className="text-muted mb-0">Live stream monitoring</p>
          </Col>
        </Row>

        <Row className="g-4">
          {/* ── RIST column ──────────────────────────────────────────── */}
          <Col xs={12} lg={6}>
            {!ristApiConfigured && (
              <Alert variant="warning" className="d-flex align-items-center gap-3 mb-3">
                <i className="bi bi-link-45deg fs-4"></i>
                <div className="flex-grow-1">
                  <strong>RIST API URL required</strong>
                  <div className="small">Configure the URL of the RIST Stats Monitor API server in settings to manage receivers.</div>
                </div>
                <Button variant="warning" size="sm" onClick={() => setSettingsOpen(true)}>
                  <i className="bi bi-gear me-1"></i>Settings
                </Button>
              </Alert>
            )}

            <ReceiversList
              receivers={receivers}
              loading={receiversLoading}
              apiConfigured={ristApiConfigured}
              serverHost={resolvedServerHost}
              developerMode={developerMode}
              onAdd={() => setAddReceiverOpen(true)}
              onDelete={deleteReceiver}
              onUpdate={updateReceiver}
              onStartRelay={startRelay}
              onStopRelay={stopRelay}
            />

            <RistFlowsList
              flows={ristFlows}
              loading={ristLoading}
              error={ristError}
              secondsUntilUpdate={ristTimer}
            />
          </Col>

          {/* ── SRT column ───────────────────────────────────────────── */}
          <Col xs={12} lg={6}>
            <SrtPublishersSection
              isAuthenticated={isAuthenticated}
              streamIds={streamIds}
              loading={srtLoading}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <RistFlowHistoryList flows={ristHistoryFlows} />
          </Col>
        </Row>
      </Container>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SetupDialog open={setupOpen} onClose={() => setSetupOpen(false)} />
      <AddReceiverDialog
        open={addReceiverOpen}
        onClose={() => setAddReceiverOpen(false)}
        onCreate={handleCreateReceiver}
        apiKey={ristApiKey}
        defaultOutputHost={resolvedServerHost}
      />
    </>
  );
};

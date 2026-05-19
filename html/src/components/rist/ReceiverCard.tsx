import React, { useState } from 'react';
import { Card } from 'react-bootstrap';
import { RistReceiver } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { CopyButton } from '../common';
import { ReceiverHeader } from './ReceiverHeader';
import { RistUrlPanel } from './RistUrlPanel';
import { SrtRelayPanel } from './SrtRelayPanel';
import { ReceiverLogsPanel } from './ReceiverLogsPanel';
import { ReceiverActions } from './ReceiverActions';
import { EditReceiverDialog } from './EditReceiverDialog';

interface ReceiverCardProps {
  receiver: RistReceiver;
  serverHost?: string;
  developerMode?: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, payload: any) => Promise<RistReceiver | void>;
  onStartRelay: (id: string, srtPort: number, passphrase?: string) => Promise<void>;
  onStopRelay: (id: string) => Promise<void>;
}

/**
 * Card view of a single RIST receiver. Composed of small panels:
 *   - ReceiverHeader      name + status + port hint
 *   - RistUrlPanel        RIST input URL (with mask / copy / QR)
 *   - UDP-out row         the configured output URL
 *   - SrtRelayPanel       SRT pull URL (when relay running) or start form (when toggled)
 *   - ReceiverActions     edit / SRT toggle / delete buttons
 *   - ReceiverLogsPanel   developer-mode log tail
 */
export const ReceiverCard: React.FC<ReceiverCardProps> = ({
  receiver, serverHost, developerMode,
  onDelete, onUpdate, onStartRelay, onStopRelay,
}) => {
  const { showPortInUrls, showQrCodes } = useSettings();
  const host = serverHost || 'localhost';

  const [editOpen, setEditOpen] = useState(false);
  const [startFormOpen, setStartFormOpen] = useState(false);
  const [relayLoading, setRelayLoading] = useState(false);

  const handleStopRelay = async () => {
    setRelayLoading(true);
    try {
      await onStopRelay(receiver.id);
    } finally {
      setRelayLoading(false);
    }
  };

  const handleStartRelay = (srtPort: number, passphrase?: string) =>
    onStartRelay(receiver.id, srtPort, passphrase);

  return (
    <Card className="mb-2">
      <Card.Body className="py-2 px-3">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div style={{ minWidth: 0, flex: 1 }}>
            <ReceiverHeader receiver={receiver} />

            <RistUrlPanel
              host={host}
              port={receiver.listenPort}
              secret={receiver.secret}
              showPort={showPortInUrls}
              showQrCodes={showQrCodes}
            />

            {/* UDP output URL (always shown, plain copy only) */}
            <div className="small mb-1">
              <div className="d-flex align-items-center gap-1">
                <span className="text-muted" style={{ minWidth: 80, fontSize: '0.75rem' }}>
                  <i className="bi bi-arrow-right me-1 opacity-75"></i>UDP Out
                </span>
                <code className="text-secondary" style={{ fontSize: '0.72rem' }}>{receiver.outputUrl}</code>
                <CopyButton text={receiver.outputUrl} />
              </div>
            </div>

            <SrtRelayPanel
              host={host}
              relay={receiver.relay}
              showQrCodes={showQrCodes}
              startFormOpen={startFormOpen}
              onCloseStartForm={() => setStartFormOpen(false)}
              onStartRelay={handleStartRelay}
            />
          </div>

          <ReceiverActions
            hasRelay={!!receiver.relay}
            startFormOpen={startFormOpen}
            relayLoading={relayLoading}
            onOpenStartForm={() => setStartFormOpen(true)}
            onStopRelay={handleStopRelay}
            onEdit={() => setEditOpen(true)}
            onDelete={() => onDelete(receiver.id)}
          />
        </div>

        {developerMode && (
          <ReceiverLogsPanel receiverId={receiver.id} hasRelay={!!receiver.relay} />
        )}

        <EditReceiverDialog
          open={editOpen}
          receiver={receiver}
          onClose={() => setEditOpen(false)}
          onUpdate={onUpdate}
        />
      </Card.Body>
    </Card>
  );
};

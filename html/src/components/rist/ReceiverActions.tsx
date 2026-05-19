import React from 'react';
import { Button } from 'react-bootstrap';

interface ReceiverActionsProps {
  hasRelay: boolean;
  startFormOpen: boolean;
  relayLoading: boolean;
  onOpenStartForm: () => void;
  onStopRelay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Right-side vertical button stack on a ReceiverCard.
 * The SRT button toggles between "Start relay form" and "Stop relay" based on relay state.
 */
export const ReceiverActions: React.FC<ReceiverActionsProps> = ({
  hasRelay, startFormOpen, relayLoading,
  onOpenStartForm, onStopRelay, onEdit, onDelete,
}) => (
  <div className="d-flex flex-column gap-1 flex-shrink-0">
    {!hasRelay && !startFormOpen && (
      <Button variant="outline-success" size="sm" onClick={onOpenStartForm} title="Start SRT relay for VLC/OBS">
        <i className="bi bi-cast me-1"></i>SRT
      </Button>
    )}
    {hasRelay && (
      <Button variant="outline-warning" size="sm" onClick={onStopRelay} disabled={relayLoading} title="Stop SRT relay">
        <i className="bi bi-cast me-1"></i>Stop
      </Button>
    )}
    <Button variant="outline-secondary" size="sm" onClick={onEdit} title="Edit receiver settings">
      <i className="bi bi-pencil"></i>
    </Button>
    <Button variant="outline-danger" size="sm" onClick={onDelete} title="Stop receiver">
      <i className="bi bi-stop-circle"></i>
    </Button>
  </div>
);

import React from 'react';
import { Badge } from 'react-bootstrap';
import { RistReceiver } from '../../types';

function statusVariant(status: RistReceiver['status']): string {
  switch (status) {
    case 'running':  return 'success';
    case 'starting': return 'warning';
    case 'error':    return 'danger';
    default:         return 'secondary';
  }
}

interface ReceiverHeaderProps {
  receiver: RistReceiver;
}

export const ReceiverHeader: React.FC<ReceiverHeaderProps> = ({ receiver }) => (
  <div className="d-flex align-items-center gap-2 mb-2">
    <i className="bi bi-hdd-network text-info"></i>
    <span className="fw-semibold text-truncate">{receiver.name}</span>
    <Badge bg={statusVariant(receiver.status)} className="text-capitalize" style={{ fontSize: '0.65rem' }}>
      {receiver.status}
    </Badge>
    {/* Always show the listen port as a subtle hint — independent of the URL toggle */}
    <span className="text-muted" style={{ fontSize: '0.65rem' }}>:{receiver.listenPort}</span>
  </div>
);

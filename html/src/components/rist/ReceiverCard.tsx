import React from 'react';
import { Card, Badge, Button } from 'react-bootstrap';
import { RistReceiver } from '../../types/rist-receiver.types';

interface ReceiverCardProps {
  receiver: RistReceiver;
  onDelete: (id: string) => void;
}

function statusVariant(status: RistReceiver['status']): string {
  switch (status) {
    case 'running':  return 'success';
    case 'starting': return 'warning';
    case 'error':    return 'danger';
    default:         return 'secondary';
  }
}

export const ReceiverCard: React.FC<ReceiverCardProps> = ({ receiver, onDelete }) => (
  <Card className="mb-2">
    <Card.Body className="py-2 px-3">
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-hdd-network text-info"></i>
            <span className="fw-medium text-truncate">{receiver.name}</span>
            <Badge bg={statusVariant(receiver.status)} className="text-capitalize">
              {receiver.status}
            </Badge>
          </div>
          <div className="text-muted small mt-1">
            UDP :{receiver.listenPort} → {receiver.outputUrl}
          </div>
        </div>
        <Button
          variant="outline-danger"
          size="sm"
          onClick={() => onDelete(receiver.id)}
          title="Stop receiver"
        >
          <i className="bi bi-stop-circle"></i>
        </Button>
      </div>
    </Card.Body>
  </Card>
);

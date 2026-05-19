import React, { useState } from 'react';
import { Button, Collapse, Spinner } from 'react-bootstrap';
import { RistReceiver } from '../../types';
import { ReceiverCard } from './ReceiverCard';

interface ReceiversListProps {
  receivers: RistReceiver[];
  loading: boolean;
  apiConfigured: boolean;
  serverHost: string;
  developerMode: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, payload: any) => Promise<RistReceiver | void>;
  onStartRelay: (id: string, srtPort: number, passphrase?: string) => Promise<void>;
  onStopRelay: (id: string) => Promise<void>;
}

/** Collapsible list of RIST receiver cards with an "Add" button. */
export const ReceiversList: React.FC<ReceiversListProps> = ({
  receivers, loading, apiConfigured, serverHost, developerMode,
  onAdd, onDelete, onUpdate, onStartRelay, onStopRelay,
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <Button
          variant="link"
          className="p-0 text-decoration-none text-light d-flex align-items-center gap-2"
          onClick={() => setExpanded(e => !e)}
        >
          <i className="bi bi-hdd-network text-info"></i>
          <span className="fw-semibold">RIST Receivers</span>
          <span className="badge bg-secondary">{receivers.length}</span>
          <i className={`bi bi-chevron-${expanded ? 'up' : 'down'} small`}></i>
        </Button>
        <Button variant="outline-info" size="sm" onClick={onAdd} disabled={!apiConfigured}>
          <i className="bi bi-plus-lg me-1"></i>Add
        </Button>
      </div>
      <Collapse in={expanded}>
        <div>
          {loading ? (
            <div className="text-center py-2"><Spinner animation="border" size="sm" /></div>
          ) : receivers.length === 0 ? (
            <p className="text-muted small mb-0">No receivers running. Click Add to start one.</p>
          ) : (
            receivers.map(r => (
              <ReceiverCard
                key={r.id}
                receiver={r}
                serverHost={serverHost}
                developerMode={developerMode}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onStartRelay={onStartRelay}
                onStopRelay={onStopRelay}
              />
            ))
          )}
        </div>
      </Collapse>
    </div>
  );
};

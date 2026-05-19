import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Collapse } from 'react-bootstrap';
import { ristApiService } from '../../services/rist-api.service';

const POLL_INTERVAL_MS = 2500;
const LOG_BOX_MAX_HEIGHT = 180;

type Tab = 'receiver' | 'relay';

interface ReceiverLogsPanelProps {
  receiverId: string;
  /** Whether a relay is running — disables the "relay" tab when false. */
  hasRelay: boolean;
}

/**
 * Developer-mode log panel. Polls receiver and relay logs from the API while open.
 * Color-codes lines containing ERROR (red) / WARNING (orange).
 */
export const ReceiverLogsPanel: React.FC<ReceiverLogsPanelProps> = ({ receiverId, hasRelay }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('receiver');
  const [receiverLogs, setReceiverLogs] = useState<string[]>([]);
  const [relayLogs, setRelayLogs] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      if (tab === 'receiver') {
        setReceiverLogs(await ristApiService.getReceiverLogs(receiverId));
      } else if (hasRelay) {
        setRelayLogs(await ristApiService.getRelayLogs(receiverId));
      }
    } catch {
      /* swallow — network blips are routine while polling */
    }
  }, [receiverId, hasRelay, tab]);

  useEffect(() => {
    if (!open) return;
    fetchLogs();
    const id = setInterval(fetchLogs, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [open, fetchLogs]);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [receiverLogs, relayLogs]);

  const lines = tab === 'receiver' ? receiverLogs : relayLogs;

  return (
    <div className="mt-2 border-top pt-2">
      <Button
        variant="link"
        size="sm"
        className="p-0 text-muted text-decoration-none d-flex align-items-center gap-1"
        onClick={() => setOpen(o => !o)}
      >
        <i className="bi bi-terminal" style={{ fontSize: '0.75rem' }}></i>
        <span style={{ fontSize: '0.75rem' }}>Logs</span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: '0.65rem' }}></i>
      </Button>
      <Collapse in={open}>
        <div>
          <div className="d-flex gap-2 mt-1 mb-1">
            <button
              className={`btn btn-link btn-sm p-0 text-decoration-none ${tab === 'receiver' ? 'text-info' : 'text-muted'}`}
              style={{ fontSize: '0.7rem' }}
              onClick={() => setTab('receiver')}
            >
              ristreceiver
            </button>
            <span className="text-muted" style={{ fontSize: '0.7rem' }}>|</span>
            <button
              className={`btn btn-link btn-sm p-0 text-decoration-none ${tab === 'relay' ? 'text-success' : 'text-muted'}`}
              style={{ fontSize: '0.7rem' }}
              onClick={() => setTab('relay')}
              disabled={!hasRelay}
            >
              srt relay
            </button>
          </div>
          <div
            ref={boxRef}
            style={{
              background: '#0d0d0d',
              borderRadius: 4,
              padding: '6px 8px',
              maxHeight: LOG_BOX_MAX_HEIGHT,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              lineHeight: 1.5,
              color: '#ccc',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {lines.length === 0
              ? <span className="text-muted">No logs yet…</span>
              : lines.map((line, i) => (
                  <div key={i} style={{ color: line.includes('ERROR') ? '#f88' : line.includes('WARNING') ? '#fa8' : '#ccc' }}>
                    {line}
                  </div>
                ))
            }
          </div>
        </div>
      </Collapse>
    </div>
  );
};

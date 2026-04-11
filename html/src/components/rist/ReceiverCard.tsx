import React, { useState } from 'react';
import { Card, Badge, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { RistReceiver } from '../../types/rist-receiver.types';

interface ReceiverCardProps {
  receiver: RistReceiver;
  serverHost?: string;   // hostname/IP extracted from the RIST API URL
  onDelete: (id: string) => void;
}

function fallbackCopy(text: string, done: () => void) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); done(); } catch {}
  document.body.removeChild(el);
}

function statusVariant(status: RistReceiver['status']): string {
  switch (status) {
    case 'running':  return 'success';
    case 'starting': return 'warning';
    case 'error':    return 'danger';
    default:         return 'secondary';
  }
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  };
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{copied ? 'Copied!' : 'Copy'}</Tooltip>}>
      <Button variant="link" size="sm" className="p-0 ms-1 text-muted" onClick={handleCopy} style={{ lineHeight: 1 }}>
        <i className={`bi bi-${copied ? 'check2' : 'copy'}`} style={{ fontSize: '0.7rem' }}></i>
      </Button>
    </OverlayTrigger>
  );
};

export const ReceiverCard: React.FC<ReceiverCardProps> = ({ receiver, serverHost, onDelete }) => {
  const host = serverHost || 'localhost';
  const ristInputUrl = `rist://${host}:${receiver.listenPort}`;

  // If output is SRT listener on 0.0.0.0, show the public pull URL instead
  const outputDisplay = (() => {
    const url = receiver.outputUrl;
    if (/^srt:\/\/(0\.0\.0\.0|::)/i.test(url) && url.toLowerCase().includes('mode=listener')) {
      try {
        const port = new URL(url.split('?')[0]).port;
        return { url: `srt://${host}:${port}`, label: 'SRT Pull URL' };
      } catch {}
    }
    return { url, label: 'Output' };
  })();

  return (
    <Card className="mb-2">
      <Card.Body className="py-2 px-3">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="d-flex align-items-center gap-2 mb-1">
              <i className="bi bi-hdd-network text-info"></i>
              <span className="fw-medium text-truncate">{receiver.name}</span>
              <Badge bg={statusVariant(receiver.status)} className="text-capitalize">
                {receiver.status}
              </Badge>
            </div>
            <div className="small">
              <div className="d-flex align-items-center gap-1 mb-1">
                <span className="text-muted" style={{ minWidth: 90 }}>
                  <i className="bi bi-broadcast me-1 text-info opacity-75"></i>
                  RIST Input
                </span>
                <code className="text-info small">{ristInputUrl}</code>
                <CopyButton text={ristInputUrl} />
              </div>
              <div className="d-flex align-items-center gap-1">
                <span className="text-muted" style={{ minWidth: 90 }}>
                  <i className="bi bi-arrow-right me-1 opacity-75"></i>
                  {outputDisplay.label}
                </span>
                <code className="text-secondary small">{outputDisplay.url}</code>
                <CopyButton text={outputDisplay.url} />
              </div>
            </div>
          </div>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => onDelete(receiver.id)}
            title="Stop receiver"
            className="flex-shrink-0"
          >
            <i className="bi bi-stop-circle"></i>
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

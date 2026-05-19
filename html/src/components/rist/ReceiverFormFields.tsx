import React from 'react';
import { Form, Badge } from 'react-bootstrap';
import { PasswordInput } from '../common';

export type PortStatus = 'idle' | 'checking' | 'available' | 'reserved' | 'used' | 'invalid';

interface ReceiverFormFieldsProps {
  /** Stream name. */
  name: string;
  onNameChange: (v: string) => void;
  /** PSK secret. */
  secret: string;
  onSecretChange: (v: string) => void;
  /** Output URL (only relevant when advanced is open). */
  outputUrl: string;
  onOutputUrlChange: (v: string) => void;
  /** Listen port — string for input control. */
  listenPort: string;
  onListenPortChange?: (v: string) => void;
  /** Lock the listen port (used by EditReceiverDialog while the receiver runs). */
  listenPortLocked?: boolean;
  /** Toggle to show/hide the Advanced fields. */
  advancedOpen: boolean;
  onAdvancedToggle: () => void;
  /** Live port status feedback (provided by parent's port-check effect). */
  portStatus?: PortStatus;
  /** Optional values currently stored on the server, used to badge changed fields in edit mode. */
  serverValues?: { name?: string; secret?: string; outputUrl?: string };
  autoFocusName?: boolean;
}

function PortFeedback({ status }: { status: PortStatus | undefined }) {
  switch (status) {
    case 'checking':  return <Form.Text className="text-muted">Checking…</Form.Text>;
    case 'available': return <Form.Text className="text-success"><i className="bi bi-check-circle me-1"></i>Available</Form.Text>;
    case 'reserved':  return <Form.Text className="text-danger"><i className="bi bi-slash-circle me-1"></i>Reserved</Form.Text>;
    case 'used':      return <Form.Text className="text-danger"><i className="bi bi-x-circle me-1"></i>In use</Form.Text>;
    case 'invalid':   return <Form.Text className="text-warning">1–65535</Form.Text>;
    default:          return <Form.Text className="text-muted">UDP port for incoming RIST stream</Form.Text>;
  }
}

const ChangedBadge: React.FC<{ show: boolean }> = ({ show }) =>
  show ? <Badge bg="warning" className="ms-2">Changed</Badge> : null;

/**
 * Shared field set for receiver create + edit dialogs.
 * Pure presentation — all state and validation lives in the parent dialog.
 */
export const ReceiverFormFields: React.FC<ReceiverFormFieldsProps> = ({
  name, onNameChange,
  secret, onSecretChange,
  outputUrl, onOutputUrlChange,
  listenPort, onListenPortChange,
  listenPortLocked = false,
  advancedOpen, onAdvancedToggle,
  portStatus,
  serverValues,
  autoFocusName,
}) => {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold">
          Stream Name <span className="text-danger">*</span>
          <ChangedBadge show={!!serverValues?.name && name !== serverValues.name} />
        </Form.Label>
        <Form.Control
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. encoder-main"
          autoFocus={autoFocusName}
        />
        <Form.Text className="text-muted">Unique identifier for this stream.</Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold">
          <i className="bi bi-lock me-1 text-warning"></i>Password (PSK)
          <ChangedBadge show={!!serverValues?.secret && secret !== serverValues.secret} />
        </Form.Label>
        <PasswordInput value={secret} onChange={onSecretChange} placeholder="min. 8 characters" />
        <Form.Text className="text-muted">
          <i className="bi bi-shield-check me-1 text-success"></i>
          Required by sender (OBS, vMix, ffmpeg) as <code>?secret=…</code> in the RIST URL.
        </Form.Text>
      </Form.Group>

      <div className="mb-2">
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-muted text-decoration-none d-flex align-items-center gap-1"
          onClick={onAdvancedToggle}
        >
          <i className={`bi bi-chevron-${advancedOpen ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
          <span style={{ fontSize: '0.8rem' }}>Advanced</span>
        </button>
      </div>

      {advancedOpen && (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Listen Port (UDP)</Form.Label>
            <Form.Control
              type="number"
              value={listenPort}
              onChange={e => onListenPortChange?.(e.target.value)}
              placeholder="5005"
              min={1}
              max={65535}
              disabled={listenPortLocked}
              isValid={!listenPortLocked && portStatus === 'available'}
              isInvalid={!listenPortLocked && (portStatus === 'reserved' || portStatus === 'used' || portStatus === 'invalid')}
              style={{ maxWidth: 140 }}
              title={listenPortLocked ? 'Cannot change port while receiver is running. Delete and recreate to change.' : undefined}
            />
            {listenPortLocked
              ? <Form.Text className="text-muted"><i className="bi bi-lock me-1"></i>Fixed while running. Delete and recreate to change port.</Form.Text>
              : <PortFeedback status={portStatus} />
            }
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              Output URL
              <ChangedBadge show={!!serverValues?.outputUrl && outputUrl !== serverValues.outputUrl} />
            </Form.Label>
            <Form.Control
              type="text"
              value={outputUrl}
              onChange={e => onOutputUrlChange(e.target.value)}
              placeholder="udp://127.0.0.1:5001"
            />
            <Form.Text className="text-muted">
              <code>udp://HOST:PORT</code> or <code>rtp://HOST:PORT</code> — decoded stream destination.
            </Form.Text>
          </Form.Group>
        </>
      )}
    </>
  );
};

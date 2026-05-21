import React, { useState } from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { copyToClipboard } from '../../utils/clipboard';

interface CopyButtonProps {
  /** The text that gets copied — usually the full URL/secret, even when masked in the UI. */
  text: string;
  /** How long to show the "Copied!" feedback. Default 1500ms. */
  feedbackMs?: number;
  className?: string;
  /** Tooltip label shown before click. Defaults to "Copy". Use to distinguish multiple copy buttons on the same row. */
  label?: string;
}

/**
 * Small icon-only copy button. Always copies the given text — independent of any
 * "show/hide" toggle in the surrounding component, so users can copy secrets
 * without ever revealing them on screen.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({ text, feedbackMs = 1500, className, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(text, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), feedbackMs);
    });
  };

  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{copied ? 'Copied!' : label}</Tooltip>}>
      <Button
        variant="link"
        size="sm"
        className={`p-0 ms-1 text-muted ${className ?? ''}`}
        onClick={handleCopy}
        style={{ lineHeight: 1 }}
      >
        <i className={`bi bi-${copied ? 'check2' : 'copy'}`} style={{ fontSize: '0.7rem' }}></i>
      </Button>
    </OverlayTrigger>
  );
};

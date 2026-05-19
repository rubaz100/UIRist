import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';

interface IconToggleButtonProps {
  /** Bootstrap-icon name without the `bi-` prefix. */
  icon: string;
  /** Alt icon shown when active. Falls back to `icon` if not provided. */
  iconActive?: string;
  active: boolean;
  onToggle: () => void;
  tooltipOn: string;
  tooltipOff: string;
  variant?: string;
}

/**
 * Compact icon-only toggle button with a tooltip. Used for inline UI affordances
 * like Show/Hide password, Open/Close QR-code, etc.
 */
export const IconToggleButton: React.FC<IconToggleButtonProps> = ({
  icon,
  iconActive,
  active,
  onToggle,
  tooltipOn,
  tooltipOff,
  variant = 'link',
}) => (
  <OverlayTrigger placement="top" overlay={<Tooltip>{active ? tooltipOn : tooltipOff}</Tooltip>}>
    <Button
      variant={variant}
      size="sm"
      className="p-0 text-muted"
      style={{ lineHeight: 1 }}
      onClick={onToggle}
    >
      <i className={`bi bi-${active ? (iconActive || icon) : icon}`} style={{ fontSize: '0.7rem' }}></i>
    </Button>
  </OverlayTrigger>
);

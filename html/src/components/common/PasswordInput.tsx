import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import { generateSecret } from '../../utils/passphrase';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show the regenerate (↻) button — default true. */
  allowGenerate?: boolean;
  /** Length passed to generateSecret(). Default 20. */
  generateLength?: number;
  /** Optional aria/label id. */
  id?: string;
  /** Disable the input + buttons. */
  disabled?: boolean;
  size?: 'sm' | 'lg';
  /** Initial visibility state. Default false (hidden). */
  initiallyVisible?: boolean;
  className?: string;
  autoComplete?: string;
}

/**
 * Password / secret input with show-hide toggle and optional regenerate button.
 * Replaces the duplicated InputGroup pattern from the receiver dialogs.
 */
export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  placeholder,
  allowGenerate = true,
  generateLength = 20,
  id,
  disabled,
  size,
  initiallyVisible = false,
  className,
  autoComplete = 'new-password',
}) => {
  const [visible, setVisible] = useState(initiallyVisible);

  return (
    <InputGroup size={size} className={className}>
      <Form.Control
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-monospace"
        disabled={disabled}
        autoComplete={autoComplete}
      />
      <Button
        variant="outline-secondary"
        onClick={() => setVisible(v => !v)}
        title={visible ? 'Hide' : 'Show'}
        disabled={disabled}
      >
        <i className={`bi bi-eye${visible ? '-slash' : ''}`}></i>
      </Button>
      {allowGenerate && (
        <Button
          variant="outline-secondary"
          onClick={() => onChange(generateSecret(generateLength))}
          title="Generate new password"
          disabled={disabled}
        >
          <i className="bi bi-arrow-clockwise"></i>
        </Button>
      )}
    </InputGroup>
  );
};

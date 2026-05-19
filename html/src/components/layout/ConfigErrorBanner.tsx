import React, { useState } from 'react';
import { Alert } from 'react-bootstrap';

interface ConfigErrorBannerProps {
  error: string | null;
}

/**
 * Banner shown at the top of the page when the backend could not load
 * /data/config.json. Tells the user their settings are local-only and may be
 * lost on restart. Dismissible.
 */
export const ConfigErrorBanner: React.FC<ConfigErrorBannerProps> = ({ error }) => {
  const [dismissed, setDismissed] = useState(false);
  if (!error || dismissed) return null;
  return (
    <Alert variant="warning" dismissible onClose={() => setDismissed(true)} className="mb-3">
      <i className="bi bi-shield-exclamation me-2"></i>
      <strong>Config could not be loaded:</strong> {error}
      <div className="small mt-1 text-muted">
        Settings are available locally, but were not loaded from the server. Data may be lost on restart.
      </div>
    </Alert>
  );
};

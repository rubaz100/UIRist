import React, { useMemo } from 'react';
import { Card, Spinner, Button } from 'react-bootstrap';
import { StreamId } from '../../types';
import { PublisherCard } from '../publisher';

interface SrtPublishersSectionProps {
  isAuthenticated: boolean;
  streamIds: StreamId[];
  loading: boolean;
  onOpenSettings: () => void;
}

/** Right-column SRT publishers grouped by publisher name. */
export const SrtPublishersSection: React.FC<SrtPublishersSectionProps> = ({
  isAuthenticated, streamIds, loading, onOpenSettings,
}) => {
  const grouped = useMemo(() => {
    const groups: Record<string, StreamId[]> = {};
    streamIds.forEach(s => {
      if (!groups[s.publisher]) groups[s.publisher] = [];
      groups[s.publisher].push(s);
    });
    return groups;
  }, [streamIds]);

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-broadcast me-2 text-primary"></i>SRT Publishers</h5>
      </div>

      {!isAuthenticated ? (
        <Card className="text-center border-warning">
          <Card.Body className="py-4">
            <i className="bi bi-key display-6 mb-2 d-block text-warning opacity-75"></i>
            <h6 className="mb-2">API key required</h6>
            <p className="text-muted small mb-3">Configure your SLS API key to monitor streams.</p>
            <Button variant="outline-warning" size="sm" onClick={onOpenSettings}>
              <i className="bi bi-gear me-1"></i>Configure
            </Button>
          </Card.Body>
        </Card>
      ) : loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status"><span className="visually-hidden">Loading…</span></Spinner>
        </div>
      ) : streamIds.length === 0 ? (
        <Card className="text-center">
          <Card.Body className="py-4">
            <i className="bi bi-broadcast display-6 mb-2 d-block opacity-50"></i>
            <h6 className="mb-2">No active SRT streams</h6>
            <p className="text-muted small mb-0">Streams are configured on the server.</p>
          </Card.Body>
        </Card>
      ) : (
        <div>
          {Object.entries(grouped).map(([publisher, ids]) => (
            <PublisherCard key={publisher} publisherName={publisher} streamIds={ids} />
          ))}
        </div>
      )}
    </>
  );
};

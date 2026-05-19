import React from 'react';
import { Alert, Card, Spinner } from 'react-bootstrap';
import { RistFlow } from '../../types';
import { RefreshTimer } from '../ui';
import { RistFlowCard } from './RistFlowCard';

interface RistFlowsListProps {
  flows: RistFlow[];
  loading: boolean;
  error: string | null;
  secondsUntilUpdate: number;
}

export const RistFlowsList: React.FC<RistFlowsListProps> = ({ flows, loading, error, secondsUntilUpdate }) => (
  <>
    <div className="d-flex align-items-center justify-content-between mb-3">
      <h5 className="mb-0"><i className="bi bi-diagram-3 me-2 text-info"></i>RIST Flows</h5>
      {!loading && !error && <RefreshTimer secondsUntilUpdate={secondsUntilUpdate} />}
    </div>

    {loading ? (
      <div className="text-center py-5">
        <Spinner animation="border" role="status"><span className="visually-hidden">Loading…</span></Spinner>
      </div>
    ) : error ? (
      <Alert variant="warning" className="mb-0">
        <i className="bi bi-exclamation-triangle me-2"></i>{error}
      </Alert>
    ) : flows.length === 0 ? (
      <Card className="text-center">
        <Card.Body className="py-4">
          <i className="bi bi-diagram-3 display-6 mb-2 d-block opacity-50"></i>
          <h6 className="mb-1">No active RIST flows</h6>
          <p className="text-muted small mb-0">Start a receiver above or configure your RIST API URL in Settings.</p>
        </Card.Body>
      </Card>
    ) : (
      <div>
        {flows.map(flow => <RistFlowCard key={`${flow.receiverId}-${flow.flowId}`} flow={flow} />)}
      </div>
    )}
  </>
);

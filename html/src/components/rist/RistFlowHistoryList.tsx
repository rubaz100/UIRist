import React from 'react';
import { HistoryFlow } from '../../types';
import { RistFlowHistoryCard } from './RistFlowHistoryCard';

interface RistFlowHistoryListProps {
  flows: HistoryFlow[];
}

/** Inactive flows that have been moved to history. Hidden when empty. */
export const RistFlowHistoryList: React.FC<RistFlowHistoryListProps> = ({ flows }) => {
  if (flows.length === 0) return null;
  return (
    <div className="mt-4">
      <h6 className="text-muted mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-clock-history"></i>
        RIST Flow History
        <span className="badge bg-secondary">{flows.length}</span>
      </h6>
      {flows.map(flow => (
        <RistFlowHistoryCard
          key={`${flow.receiverId}-${flow.flowId}-${flow.disappearedAt}`}
          flow={flow}
        />
      ))}
    </div>
  );
};

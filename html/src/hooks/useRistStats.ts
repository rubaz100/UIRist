import { useState, useEffect, useCallback, useRef } from 'react';
import { RistFlow, HistoryFlow } from '../types/rist.types';
import { ristApiService } from '../services/rist-api.service';
import { useRefreshTimer } from './useRefreshTimer';

const REFRESH_INTERVAL = 5; // seconds

const flowKey = (f: RistFlow) => `${f.receiverId ?? ''}-${f.flowId}`;

interface UseRistStatsResult {
  flows: RistFlow[];
  historyFlows: HistoryFlow[];
  loading: boolean;
  error: string | null;
  secondsUntilUpdate: number;
}

export const useRistStats = (
  apiUrl: string,
  apiKey: string = '',
  flowHistoryTimeout: number = 30,
): UseRistStatsResult => {
  const [flows, setFlows] = useState<RistFlow[]>([]);
  const [historyFlows, setHistoryFlows] = useState<HistoryFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // flowKey → timestamp when it first had 0 active peers (or disappeared)
  const inactiveSinceRef = useRef<Map<string, number>>(new Map());
  // flowKey → last known flow state (for history snapshot)
  const lastKnownRef = useRef<Map<string, RistFlow>>(new Map());

  const fetchFlows = useCallback(async () => {
    if (!apiUrl || apiUrl.startsWith('{{')) {
      setLoading(false);
      setError('RIST API URL not configured. Set it in Settings.');
      return;
    }

    ristApiService.setBaseUrl(apiUrl);
    ristApiService.setApiKey(apiKey);
    try {
      const data = await ristApiService.getStats();
      const now = Date.now();
      const currentKeys = new Set(data.map(flowKey));

      // Update tracking for each received flow
      for (const flow of data) {
        const key = flowKey(flow);
        lastKnownRef.current.set(key, flow);

        const hasActive = (flow.peers ?? []).some(p => p.dead === 0);
        if (hasActive) {
          inactiveSinceRef.current.delete(key); // reset — flow is live again
        } else if (!inactiveSinceRef.current.has(key)) {
          inactiveSinceRef.current.set(key, now); // start inactivity countdown
        }
      }

      // Flows that vanished from API entirely also start their countdown
      for (const key of Array.from(lastKnownRef.current.keys())) {
        if (!currentKeys.has(key) && !inactiveSinceRef.current.has(key)) {
          inactiveSinceRef.current.set(key, now);
        }
      }

      // Promote timed-out flows to history
      if (flowHistoryTimeout > 0) {
        const promoted: HistoryFlow[] = [];
        for (const [key, since] of Array.from(inactiveSinceRef.current.entries())) {
          if (now - since >= flowHistoryTimeout * 1000) {
            const last = lastKnownRef.current.get(key);
            if (last) promoted.push({ ...last, disappearedAt: now });
            inactiveSinceRef.current.delete(key);
            lastKnownRef.current.delete(key);
          }
        }
        if (promoted.length > 0) {
          setHistoryFlows(prev => {
            // Newest first, deduplicated by key, capped at 20 entries
            const seen = new Set<string>();
            return [...promoted, ...prev]
              .filter(f => { const k = flowKey(f); if (seen.has(k)) return false; seen.add(k); return true; })
              .slice(0, 20);
          });
        }
      }

      setFlows(data);
      setError(null);
    } catch (err: any) {
      setFlows([]);
      const status = err?.response?.status;
      if (!status) {
        setError('Cannot reach RIST API. Make sure the API server is running (node api/server.js).');
      } else {
        setError(`RIST API error ${status}: ${err?.response?.data?.error ?? err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apiKey, flowHistoryTimeout]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const secondsUntilUpdate = useRefreshTimer(fetchFlows, REFRESH_INTERVAL);

  return { flows, historyFlows, loading, error, secondsUntilUpdate };
};

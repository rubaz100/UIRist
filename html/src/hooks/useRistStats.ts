import { useState, useEffect, useCallback } from 'react';
import { RistFlow } from '../types/rist.types';
import { ristApiService } from '../services/rist-api.service';
import { useRefreshTimer } from './useRefreshTimer';

const REFRESH_INTERVAL = 5; // seconds

interface UseRistStatsResult {
  flows: RistFlow[];
  loading: boolean;
  error: string | null;
  secondsUntilUpdate: number;
}

export const useRistStats = (apiUrl: string, apiKey: string = ''): UseRistStatsResult => {
  const [flows, setFlows] = useState<RistFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [apiUrl, apiKey]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const secondsUntilUpdate = useRefreshTimer(fetchFlows, REFRESH_INTERVAL);

  return { flows, loading, error, secondsUntilUpdate };
};

import { useState, useEffect, useCallback } from 'react';
import { RistFlow } from '../types/rist.types';
import { getRistFlows } from '../services/rist.service';
import { useRefreshTimer } from './useRefreshTimer';

const REFRESH_INTERVAL = 5; // seconds

interface UseRistStatsResult {
  flows: RistFlow[];
  loading: boolean;
  error: string | null;
  secondsUntilUpdate: number;
}

export const useRistStats = (metricsUrl: string): UseRistStatsResult => {
  const [flows, setFlows] = useState<RistFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    if (!metricsUrl || metricsUrl.startsWith('{{')) {
      setLoading(false);
      setError('RIST Metrics URL not configured.');
      return;
    }

    try {
      const data = await getRistFlows(metricsUrl);
      setFlows(data);
      setError(null);
    } catch (err: any) {
      setFlows([]);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError(
          'Cannot reach RIST metrics endpoint. Make sure ristreceiver is running with ' +
          '--metrics-http and the URL is CORS-accessible.'
        );
      } else {
        setError(err?.message ?? 'Failed to fetch RIST metrics.');
      }
    } finally {
      setLoading(false);
    }
  }, [metricsUrl]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const secondsUntilUpdate = useRefreshTimer(fetchFlows, REFRESH_INTERVAL);

  return { flows, loading, error, secondsUntilUpdate };
};

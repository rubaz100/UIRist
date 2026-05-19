import { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api.service';
import { StreamId } from '../types';

interface UseSrtPublishersResult {
  streamIds: StreamId[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Fetches SRT stream IDs from the SLS API. No-op when not authenticated. */
export function useSrtPublishers(isAuthenticated: boolean): UseSrtPublishersResult {
  const [streamIds, setStreamIds] = useState<StreamId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await apiService.getStreamIds();
      setStreamIds(data);
    } catch (err: any) {
      setError(err?.response?.status === 401
        ? 'Authentication failed. Please check your API key in settings.'
        : 'Failed to fetch stream IDs. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { refresh(); }, [refresh]);

  return { streamIds, loading, error, refresh };
}

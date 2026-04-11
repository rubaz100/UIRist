import { useState, useCallback, useEffect } from 'react';
import { RistReceiver } from '../types/rist-receiver.types';
import { ristApiService } from '../services/rist-api.service';
import { CreateReceiverPayload } from '../services/rist-api.service';

interface UseRistReceiversResult {
  receivers: RistReceiver[];
  loading: boolean;
  error: string | null;
  createReceiver: (payload: CreateReceiverPayload) => Promise<RistReceiver>;
  deleteReceiver: (id: string) => Promise<void>;
  refresh: () => void;
}

export const useRistReceivers = (apiUrl: string): UseRistReceiversResult => {
  const [receivers, setReceivers] = useState<RistReceiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceivers = useCallback(async () => {
    if (!apiUrl || apiUrl.startsWith('{{')) {
      setLoading(false);
      return;
    }
    ristApiService.setBaseUrl(apiUrl);
    try {
      const data = await ristApiService.getReceivers();
      setReceivers(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch receivers');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => { fetchReceivers(); }, [fetchReceivers]);

  const createReceiver = async (payload: CreateReceiverPayload): Promise<RistReceiver> => {
    ristApiService.setBaseUrl(apiUrl);
    const rec = await ristApiService.createReceiver(payload);
    setReceivers(prev => [...prev, rec]);
    return rec;
  };

  const deleteReceiver = async (id: string): Promise<void> => {
    ristApiService.setBaseUrl(apiUrl);
    await ristApiService.deleteReceiver(id);
    setReceivers(prev => prev.filter(r => r.id !== id));
  };

  return { receivers, loading, error, createReceiver, deleteReceiver, refresh: fetchReceivers };
};

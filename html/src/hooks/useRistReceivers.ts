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
  startRelay: (receiverId: string, srtPort: number) => Promise<void>;
  stopRelay: (receiverId: string) => Promise<void>;
  refresh: () => void;
}

export const useRistReceivers = (apiUrl: string, apiKey: string = ''): UseRistReceiversResult => {
  const [receivers, setReceivers] = useState<RistReceiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceivers = useCallback(async () => {
    if (!apiUrl || apiUrl.startsWith('{{')) {
      setLoading(false);
      return;
    }
    ristApiService.setBaseUrl(apiUrl);
    ristApiService.setApiKey(apiKey);
    try {
      const data = await ristApiService.getReceivers();
      setReceivers(data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to fetch receivers');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apiKey]);

  useEffect(() => { fetchReceivers(); }, [fetchReceivers]);

  const createReceiver = async (payload: CreateReceiverPayload): Promise<RistReceiver> => {
    ristApiService.setBaseUrl(apiUrl);
    ristApiService.setApiKey(apiKey);
    const rec = await ristApiService.createReceiver(payload);
    setReceivers(prev => [...prev, rec]);
    return rec;
  };

  const deleteReceiver = async (id: string): Promise<void> => {
    ristApiService.setBaseUrl(apiUrl);
    ristApiService.setApiKey(apiKey);
    await ristApiService.deleteReceiver(id);
    setReceivers(prev => prev.filter(r => r.id !== id));
  };

  const startRelay = async (receiverId: string, srtPort: number): Promise<void> => {
    ristApiService.setBaseUrl(apiUrl);
    ristApiService.setApiKey(apiKey);
    const relay = await ristApiService.startRelay(receiverId, srtPort);
    setReceivers(prev => prev.map(r => r.id === receiverId ? { ...r, relay } : r));
    // refresh after 1.5s to pick up the updated status (starting → running)
    setTimeout(fetchReceivers, 1500);
  };

  const stopRelay = async (receiverId: string): Promise<void> => {
    ristApiService.setBaseUrl(apiUrl);
    ristApiService.setApiKey(apiKey);
    await ristApiService.stopRelay(receiverId);
    setReceivers(prev => prev.map(r => r.id === receiverId ? { ...r, relay: null } : r));
  };

  return { receivers, loading, error, createReceiver, deleteReceiver, startRelay, stopRelay, refresh: fetchReceivers };
};

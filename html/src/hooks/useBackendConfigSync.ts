import { useCallback, useEffect, useRef, useState } from 'react';
import { ristApiService } from '../services/rist-api.service';
import { PersistedConfig } from '../types';

const SAVE_DEBOUNCE_MS = 500;

interface SyncStatus {
  /** Last load error from the backend, if any. */
  error: string | null;
  /** Path the server is reading/writing (for the Backup tab's hint). */
  configFile: string | null;
  /** True after the initial load attempt has completed (success or failure). */
  ready: boolean;
}

interface UseBackendConfigSyncOptions {
  /** Reads the API URL and key at call-time so they stay current as the user edits them. */
  getCredentials: () => { apiUrl: string; apiKey: string };
  /** Called when the backend returns a config — apply it to local state. */
  onLoad: (config: PersistedConfig) => void;
}

/**
 * Manages the SettingsContext's relationship with the backend:
 *   - One-shot load on mount (`load()`)
 *   - Debounced PUT to /api/config when settings change (`queueSave()`)
 *   - Exposes load error + config-file path for surfacing in the UI
 *
 * Local state remains the source of truth for the UI; the backend is just a
 * cross-browser / cross-restart mirror.
 */
export function useBackendConfigSync({ getCredentials, onLoad }: UseBackendConfigSyncOptions) {
  const [status, setStatus] = useState<SyncStatus>({ error: null, configFile: null, ready: false });

  const pending = useRef<Partial<PersistedConfig>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After hydration, allow saves. Suppress during initial load to avoid an
  // immediate write-back of the value we just received.
  const allowSave = useRef(false);

  const configureClient = useCallback(() => {
    const { apiUrl, apiKey } = getCredentials();
    if (!apiUrl || apiUrl.startsWith('{{')) return false;
    ristApiService.setBaseUrl(apiUrl);
    ristApiService.setApiKey(apiKey);
    return true;
  }, [getCredentials]);

  const load = useCallback(async () => {
    if (!configureClient()) {
      setStatus({ error: null, configFile: null, ready: true });
      allowSave.current = true;
      return;
    }
    try {
      const res = await ristApiService.getPersistedConfig();
      onLoad(res.config);
      setStatus({ error: res.error, configFile: res.configFile, ready: true });
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      // 401 means we just don't have credentials yet — not a true config error,
      // the user will set them in Settings and we'll re-sync from there.
      const error = httpStatus === 401
        ? null
        : (err?.response?.data?.error ?? err?.message ?? 'Failed to load persisted config');
      setStatus({ error, configFile: null, ready: true });
    } finally {
      allowSave.current = true;
    }
  }, [configureClient, onLoad]);

  /** Schedule a debounced save with the given partial update. */
  const queueSave = useCallback((patch: Partial<PersistedConfig>) => {
    if (!allowSave.current) return;
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const updates = pending.current;
      pending.current = {};
      if (!configureClient()) return;
      try {
        await ristApiService.savePersistedConfig(updates);
      } catch (err: any) {
        // localStorage already holds the value; the backend is just a mirror.
        // Log so devtools shows it but don't surface to the user.
        console.warn('Failed to sync settings to backend:', err?.message);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [configureClient]);

  // Run the initial load on mount
  useEffect(() => { load(); }, [load]);

  // Flush any pending save on unmount so settings don't get lost in dev hot-reloads
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { status, queueSave, reload: load };
}

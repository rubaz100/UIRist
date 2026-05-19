import React, { createContext, useCallback, useContext, useMemo, ReactNode } from 'react';
import config from '../config';
import { PersistedConfig } from '../types';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useBackendConfigSync } from '../hooks/useBackendConfigSync';

// ── localStorage keys (kept stable for backward compat with existing installs) ──
const LS = {
  advancedMode: 'srt-advanced-mode',
  developerMode: 'developer-mode',
  showQrCodes: 'show-qr-codes',
  ristApiUrl: 'rist-api-url',
  ristApiKey: 'rist-api-key',
  ristServerHost: 'rist-server-host',
  flowHistoryTimeout: 'rist-flow-history-timeout',
  // Cross-context bridge — AuthContext listens for storage events on this key.
  srtApiKey: 'srt-api-key',
} as const;

interface SettingsContextType {
  advancedMode: boolean;
  setAdvancedMode: (enabled: boolean) => void;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  showQrCodes: boolean;
  setShowQrCodes: (enabled: boolean) => void;
  ristApiUrl: string;
  setRistApiUrl: (url: string) => void;
  ristApiKey: string;
  setRistApiKey: (key: string) => void;
  ristServerHost: string;
  setRistServerHost: (host: string) => void;
  flowHistoryTimeout: number;
  setFlowHistoryTimeout: (s: number) => void;
  // Backend persistence status
  configError: string | null;
  configFile: string | null;
  reloadConfig: () => Promise<void>;
  applyImportedConfig: (cfg: PersistedConfig) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Resolve initial defaults: prefer build-time injected values unless they're
// still the unreplaced `{{PLACEHOLDER}}` tokens (which means the bundle was
// served without runtime substitution).
const initialRistApiUrl = config.ristApiUrl.startsWith('{{') ? 'http://localhost:3001' : config.ristApiUrl;
const initialRistServerHost = config.ristServerHost.startsWith('{{') ? '' : config.ristServerHost;

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [advancedMode, setAdvancedModeLS] = useLocalStorageState<boolean>(LS.advancedMode, false);
  const [developerMode, setDeveloperModeLS] = useLocalStorageState<boolean>(LS.developerMode, false);
  const [showQrCodes, setShowQrCodesLS] = useLocalStorageState<boolean>(LS.showQrCodes, false);
  const [ristApiUrl, setRistApiUrlLS] = useLocalStorageState<string>(LS.ristApiUrl, initialRistApiUrl);
  const [ristApiKey, setRistApiKeyLS] = useLocalStorageState<string>(LS.ristApiKey, '');
  const [ristServerHost, setRistServerHostLS] = useLocalStorageState<string>(LS.ristServerHost, initialRistServerHost);
  const [flowHistoryTimeout, setFlowHistoryTimeoutLS] = useLocalStorageState<number>(LS.flowHistoryTimeout, 30);

  /**
   * Apply a config object from the backend (or imported file) to local state.
   * Bypasses the debounced backend save (no re-sync loop) by writing to localStorage
   * directly through the LS setters — these don't trigger queueSave().
   *
   * Also dispatches a synthetic storage event on the SRT key so AuthContext picks it up.
   */
  const applyConfig = useCallback((cfg: PersistedConfig) => {
    if (cfg.advancedMode !== undefined) setAdvancedModeLS(!!cfg.advancedMode);
    if (cfg.developerMode !== undefined) setDeveloperModeLS(!!cfg.developerMode);
    if (cfg.showQrCodes !== undefined) setShowQrCodesLS(!!cfg.showQrCodes);
    if (cfg.ristApiUrl) setRistApiUrlLS(cfg.ristApiUrl);
    if (cfg.ristApiKey !== undefined) setRistApiKeyLS(cfg.ristApiKey);
    if (cfg.ristServerHost !== undefined) setRistServerHostLS(cfg.ristServerHost);
    if (cfg.flowHistoryTimeout !== undefined) setFlowHistoryTimeoutLS(Number(cfg.flowHistoryTimeout));
    if (cfg.srtApiKey !== undefined) {
      // Propagate to AuthContext via localStorage + manual storage event
      try { localStorage.setItem(LS.srtApiKey, cfg.srtApiKey); } catch {}
      window.dispatchEvent(new StorageEvent('storage', { key: LS.srtApiKey, newValue: cfg.srtApiKey }));
    }
  }, [
    setAdvancedModeLS, setDeveloperModeLS, setShowQrCodesLS,
    setRistApiUrlLS, setRistApiKeyLS, setRistServerHostLS, setFlowHistoryTimeoutLS,
  ]);

  const { status, queueSave, reload } = useBackendConfigSync({
    // Read latest values from localStorage at request-time — useState closure
    // would capture stale values during the initial load.
    getCredentials: () => ({
      apiUrl: (typeof window !== 'undefined' ? localStorage.getItem(LS.ristApiUrl) : null) || initialRistApiUrl,
      apiKey: (typeof window !== 'undefined' ? localStorage.getItem(LS.ristApiKey) : null) || '',
    }),
    onLoad: applyConfig,
  });

  // Wrap each setter to also queue a backend save with the patched key.
  const setAdvancedMode      = useCallback((v: boolean) => { setAdvancedModeLS(v); queueSave({ advancedMode: v }); }, [setAdvancedModeLS, queueSave]);
  const setDeveloperMode     = useCallback((v: boolean) => { setDeveloperModeLS(v); queueSave({ developerMode: v }); }, [setDeveloperModeLS, queueSave]);
  const setShowQrCodes       = useCallback((v: boolean) => { setShowQrCodesLS(v); queueSave({ showQrCodes: v }); }, [setShowQrCodesLS, queueSave]);
  const setRistApiUrl        = useCallback((v: string)  => { setRistApiUrlLS(v); queueSave({ ristApiUrl: v }); }, [setRistApiUrlLS, queueSave]);
  const setRistApiKey        = useCallback((v: string)  => { setRistApiKeyLS(v); queueSave({ ristApiKey: v }); }, [setRistApiKeyLS, queueSave]);
  const setRistServerHost    = useCallback((v: string)  => { setRistServerHostLS(v); queueSave({ ristServerHost: v }); }, [setRistServerHostLS, queueSave]);
  const setFlowHistoryTimeout= useCallback((v: number)  => { setFlowHistoryTimeoutLS(v); queueSave({ flowHistoryTimeout: v }); }, [setFlowHistoryTimeoutLS, queueSave]);

  const value = useMemo<SettingsContextType>(() => ({
    advancedMode, setAdvancedMode,
    developerMode, setDeveloperMode,
    showQrCodes, setShowQrCodes,
    ristApiUrl, setRistApiUrl,
    ristApiKey, setRistApiKey,
    ristServerHost, setRistServerHost,
    flowHistoryTimeout, setFlowHistoryTimeout,
    configError: status.error,
    configFile: status.configFile,
    reloadConfig: reload,
    applyImportedConfig: applyConfig,
  }), [
    advancedMode, developerMode, showQrCodes,
    ristApiUrl, ristApiKey, ristServerHost, flowHistoryTimeout,
    status.error, status.configFile,
    setAdvancedMode, setDeveloperMode, setShowQrCodes,
    setRistApiUrl, setRistApiKey, setRistServerHost, setFlowHistoryTimeout,
    reload, applyConfig,
  ]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
};

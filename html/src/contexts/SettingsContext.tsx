import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import config from '../config';
import { ristApiService, PersistedConfig } from '../services/rist-api.service';

interface SettingsContextType {
  advancedMode: boolean;
  setAdvancedMode: (enabled: boolean) => void;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  showPortInUrls: boolean;
  setShowPortInUrls: (enabled: boolean) => void;
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
  // Backend config persistence status
  configError: string | null;
  configFile: string | null;
  reloadConfig: () => Promise<void>;
  applyImportedConfig: (cfg: PersistedConfig) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [advancedMode, setAdvancedModeState] = useState<boolean>(false);
  const [developerMode, setDeveloperModeState] = useState<boolean>(false);
  const [showPortInUrls, setShowPortInUrlsState] = useState<boolean>(false);
  const [showQrCodes, setShowQrCodesState] = useState<boolean>(false);
  const rawRistApiUrl = config.ristApiUrl.startsWith('{{') ? 'http://localhost:3001' : config.ristApiUrl;
  const rawRistServerHost = config.ristServerHost.startsWith('{{') ? '' : config.ristServerHost;
  const [ristApiUrl, setRistApiUrlState] = useState<string>(rawRistApiUrl);
  const [ristApiKey, setRistApiKeyState] = useState<string>('');
  const [ristServerHost, setRistServerHostState] = useState<string>(rawRistServerHost);
  const [flowHistoryTimeout, setFlowHistoryTimeoutState] = useState<number>(30);

  const [configError, setConfigError] = useState<string | null>(null);
  const [configFile, setConfigFile] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Push a single key/value to backend (debounced via simple ref-based scheduler)
  const pendingUpdates = useRef<Partial<PersistedConfig>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueBackendSave = (patch: Partial<PersistedConfig>) => {
    if (!initialLoadDone.current) return; // don't save during initial hydration
    pendingUpdates.current = { ...pendingUpdates.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updates = pendingUpdates.current;
      pendingUpdates.current = {};
      try {
        const apiUrl = (localStorage.getItem('rist-api-url') || rawRistApiUrl);
        const apiKey = localStorage.getItem('rist-api-key') || '';
        if (!apiUrl || apiUrl.startsWith('{{')) return;
        ristApiService.setBaseUrl(apiUrl);
        ristApiService.setApiKey(apiKey);
        await ristApiService.savePersistedConfig(updates);
      } catch (err: any) {
        // Silent fail — localStorage is the authoritative client copy
        console.warn('Failed to sync settings to backend:', err?.message);
      }
    }, 500);
  };

  // Initial load: localStorage first (instant) then backend (override + error report)
  useEffect(() => {
    const savedAdvancedMode = localStorage.getItem('srt-advanced-mode');
    if (savedAdvancedMode === 'true') setAdvancedModeState(true);

    const savedDeveloperMode = localStorage.getItem('developer-mode');
    if (savedDeveloperMode === 'true') setDeveloperModeState(true);

    const savedShowPortInUrls = localStorage.getItem('show-port-in-urls');
    if (savedShowPortInUrls === 'true') setShowPortInUrlsState(true);

    const savedShowQrCodes = localStorage.getItem('show-qr-codes');
    if (savedShowQrCodes === 'true') setShowQrCodesState(true);

    const savedRistApiUrl = localStorage.getItem('rist-api-url');
    if (savedRistApiUrl) setRistApiUrlState(savedRistApiUrl);

    const savedRistApiKey = localStorage.getItem('rist-api-key');
    if (savedRistApiKey) setRistApiKeyState(savedRistApiKey);

    const savedRistServerHost = localStorage.getItem('rist-server-host');
    if (savedRistServerHost) setRistServerHostState(savedRistServerHost);

    const savedFlowHistoryTimeout = localStorage.getItem('rist-flow-history-timeout');
    if (savedFlowHistoryTimeout !== null) setFlowHistoryTimeoutState(Number(savedFlowHistoryTimeout));

    // Now try to load from backend (will override localStorage if successful)
    (async () => {
      const apiUrl = savedRistApiUrl || rawRistApiUrl;
      const apiKey = savedRistApiKey || '';
      if (!apiUrl || apiUrl.startsWith('{{')) {
        initialLoadDone.current = true;
        return;
      }
      try {
        ristApiService.setBaseUrl(apiUrl);
        ristApiService.setApiKey(apiKey);
        const res = await ristApiService.getPersistedConfig();
        applyConfigFromBackend(res.config);
        setConfigError(res.error);
        setConfigFile(res.configFile);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401) {
          // Auth required — keep localStorage values, don't show as error
          setConfigError(null);
        } else {
          setConfigError(err?.response?.data?.error ?? err?.message ?? 'Failed to load persisted config');
        }
      } finally {
        initialLoadDone.current = true;
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyConfigFromBackend = (cfg: PersistedConfig) => {
    if (cfg.advancedMode !== undefined) {
      setAdvancedModeState(!!cfg.advancedMode);
      localStorage.setItem('srt-advanced-mode', String(!!cfg.advancedMode));
    }
    if (cfg.developerMode !== undefined) {
      setDeveloperModeState(!!cfg.developerMode);
      localStorage.setItem('developer-mode', String(!!cfg.developerMode));
    }
    if (cfg.showPortInUrls !== undefined) {
      setShowPortInUrlsState(!!cfg.showPortInUrls);
      localStorage.setItem('show-port-in-urls', String(!!cfg.showPortInUrls));
    }
    if (cfg.showQrCodes !== undefined) {
      setShowQrCodesState(!!cfg.showQrCodes);
      localStorage.setItem('show-qr-codes', String(!!cfg.showQrCodes));
    }
    if (cfg.ristApiUrl) {
      setRistApiUrlState(cfg.ristApiUrl);
      localStorage.setItem('rist-api-url', cfg.ristApiUrl);
    }
    if (cfg.ristApiKey !== undefined) {
      setRistApiKeyState(cfg.ristApiKey);
      localStorage.setItem('rist-api-key', cfg.ristApiKey);
    }
    if (cfg.ristServerHost !== undefined) {
      setRistServerHostState(cfg.ristServerHost);
      localStorage.setItem('rist-server-host', cfg.ristServerHost);
    }
    if (cfg.flowHistoryTimeout !== undefined) {
      setFlowHistoryTimeoutState(Number(cfg.flowHistoryTimeout));
      localStorage.setItem('rist-flow-history-timeout', String(cfg.flowHistoryTimeout));
    }
    if (cfg.srtApiKey !== undefined) {
      // Forwarded to AuthContext via localStorage (existing key it watches)
      localStorage.setItem('srt-api-key', cfg.srtApiKey);
      // Notify AuthContext via storage event (cross-component bridge)
      window.dispatchEvent(new StorageEvent('storage', { key: 'srt-api-key', newValue: cfg.srtApiKey }));
    }
  };

  const reloadConfig = async () => {
    try {
      ristApiService.setBaseUrl(ristApiUrl);
      ristApiService.setApiKey(ristApiKey);
      const res = await ristApiService.getPersistedConfig();
      applyConfigFromBackend(res.config);
      setConfigError(res.error);
      setConfigFile(res.configFile);
    } catch (err: any) {
      setConfigError(err?.response?.data?.error ?? err?.message ?? 'Failed to load persisted config');
    }
  };

  const applyImportedConfig = (cfg: PersistedConfig) => {
    applyConfigFromBackend(cfg);
    setConfigError(null);
  };

  const setAdvancedMode = (enabled: boolean) => {
    setAdvancedModeState(enabled);
    localStorage.setItem('srt-advanced-mode', enabled.toString());
    queueBackendSave({ advancedMode: enabled });
  };

  const setDeveloperMode = (enabled: boolean) => {
    setDeveloperModeState(enabled);
    localStorage.setItem('developer-mode', enabled.toString());
    queueBackendSave({ developerMode: enabled });
  };

  const setShowPortInUrls = (enabled: boolean) => {
    setShowPortInUrlsState(enabled);
    localStorage.setItem('show-port-in-urls', enabled.toString());
    queueBackendSave({ showPortInUrls: enabled });
  };

  const setShowQrCodes = (enabled: boolean) => {
    setShowQrCodesState(enabled);
    localStorage.setItem('show-qr-codes', enabled.toString());
    queueBackendSave({ showQrCodes: enabled });
  };

  const setRistApiUrl = (url: string) => {
    setRistApiUrlState(url);
    localStorage.setItem('rist-api-url', url);
    queueBackendSave({ ristApiUrl: url });
  };

  const setRistApiKey = (key: string) => {
    setRistApiKeyState(key);
    localStorage.setItem('rist-api-key', key);
    queueBackendSave({ ristApiKey: key });
  };

  const setRistServerHost = (host: string) => {
    setRistServerHostState(host);
    localStorage.setItem('rist-server-host', host);
    queueBackendSave({ ristServerHost: host });
  };

  const setFlowHistoryTimeout = (s: number) => {
    setFlowHistoryTimeoutState(s);
    localStorage.setItem('rist-flow-history-timeout', String(s));
    queueBackendSave({ flowHistoryTimeout: s });
  };

  return (
    <SettingsContext.Provider value={{
      advancedMode, setAdvancedMode,
      developerMode, setDeveloperMode,
      showPortInUrls, setShowPortInUrls,
      showQrCodes, setShowQrCodes,
      ristApiUrl, setRistApiUrl,
      ristApiKey, setRistApiKey,
      ristServerHost, setRistServerHost,
      flowHistoryTimeout, setFlowHistoryTimeout,
      configError, configFile, reloadConfig, applyImportedConfig,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};

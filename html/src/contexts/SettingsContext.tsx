import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import config from '../config';

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
  }, []);

  const setAdvancedMode = (enabled: boolean) => {
    setAdvancedModeState(enabled);
    localStorage.setItem('srt-advanced-mode', enabled.toString());
  };

  const setDeveloperMode = (enabled: boolean) => {
    setDeveloperModeState(enabled);
    localStorage.setItem('developer-mode', enabled.toString());
  };

  const setShowPortInUrls = (enabled: boolean) => {
    setShowPortInUrlsState(enabled);
    localStorage.setItem('show-port-in-urls', enabled.toString());
  };

  const setShowQrCodes = (enabled: boolean) => {
    setShowQrCodesState(enabled);
    localStorage.setItem('show-qr-codes', enabled.toString());
  };

  const setRistApiUrl = (url: string) => {
    setRistApiUrlState(url);
    localStorage.setItem('rist-api-url', url);
  };

  const setRistApiKey = (key: string) => {
    setRistApiKeyState(key);
    localStorage.setItem('rist-api-key', key);
  };

  const setRistServerHost = (host: string) => {
    setRistServerHostState(host);
    localStorage.setItem('rist-server-host', host);
  };

  const setFlowHistoryTimeout = (s: number) => {
    setFlowHistoryTimeoutState(s);
    localStorage.setItem('rist-flow-history-timeout', String(s));
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

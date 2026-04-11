import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import config from '../config';

interface SettingsContextType {
  advancedMode: boolean;
  setAdvancedMode: (enabled: boolean) => void;
  ristApiUrl: string;
  setRistApiUrl: (url: string) => void;
  ristApiKey: string;
  setRistApiKey: (key: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [advancedMode, setAdvancedModeState] = useState<boolean>(false);
  const rawRistApiUrl = config.ristApiUrl.startsWith('{{') ? 'http://localhost:3001' : config.ristApiUrl;
  const [ristApiUrl, setRistApiUrlState] = useState<string>(rawRistApiUrl);
  const [ristApiKey, setRistApiKeyState] = useState<string>('');

  useEffect(() => {
    const savedAdvancedMode = localStorage.getItem('srt-advanced-mode');
    if (savedAdvancedMode === 'true') setAdvancedModeState(true);

    const savedRistApiUrl = localStorage.getItem('rist-api-url');
    if (savedRistApiUrl) setRistApiUrlState(savedRistApiUrl);

    const savedRistApiKey = localStorage.getItem('rist-api-key');
    if (savedRistApiKey) setRistApiKeyState(savedRistApiKey);
  }, []);

  const setAdvancedMode = (enabled: boolean) => {
    setAdvancedModeState(enabled);
    localStorage.setItem('srt-advanced-mode', enabled.toString());
  };

  const setRistApiUrl = (url: string) => {
    setRistApiUrlState(url);
    localStorage.setItem('rist-api-url', url);
  };

  const setRistApiKey = (key: string) => {
    setRistApiKeyState(key);
    localStorage.setItem('rist-api-key', key);
  };

  return (
    <SettingsContext.Provider value={{
      advancedMode, setAdvancedMode,
      ristApiUrl, setRistApiUrl,
      ristApiKey, setRistApiKey,
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

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import config from '../config';

interface SettingsContextType {
  advancedMode: boolean;
  setAdvancedMode: (enabled: boolean) => void;
  ristApiUrl: string;
  setRistApiUrl: (url: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [advancedMode, setAdvancedModeState] = useState<boolean>(false);
  const [ristApiUrl, setRistApiUrlState] = useState<string>(config.ristApiUrl);

  useEffect(() => {
    const savedAdvancedMode = localStorage.getItem('srt-advanced-mode');
    if (savedAdvancedMode === 'true') setAdvancedModeState(true);

    const savedRistApiUrl = localStorage.getItem('rist-api-url');
    if (savedRistApiUrl) setRistApiUrlState(savedRistApiUrl);
  }, []);

  const setAdvancedMode = (enabled: boolean) => {
    setAdvancedModeState(enabled);
    localStorage.setItem('srt-advanced-mode', enabled.toString());
  };

  const setRistApiUrl = (url: string) => {
    setRistApiUrlState(url);
    localStorage.setItem('rist-api-url', url);
  };

  return (
    <SettingsContext.Provider value={{ advancedMode, setAdvancedMode, ristApiUrl, setRistApiUrl }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};

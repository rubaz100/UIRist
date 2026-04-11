import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import config from '../config';

export type ServiceType = 'srt' | 'rist';

interface SettingsContextType {
  advancedMode: boolean;
  setAdvancedMode: (enabled: boolean) => void;
  ristApiUrl: string;
  setRistApiUrl: (url: string) => void;
  enabledServices: ServiceType[];
  setEnabledServices: (services: ServiceType[]) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [advancedMode, setAdvancedModeState] = useState<boolean>(false);
  const rawRistApiUrl = config.ristApiUrl.startsWith('{{') ? 'http://localhost:3001' : config.ristApiUrl;
  const [ristApiUrl, setRistApiUrlState] = useState<string>(rawRistApiUrl);
  const [enabledServices, setEnabledServicesState] = useState<ServiceType[]>([]);

  useEffect(() => {
    const savedAdvancedMode = localStorage.getItem('srt-advanced-mode');
    if (savedAdvancedMode === 'true') setAdvancedModeState(true);

    const savedRistApiUrl = localStorage.getItem('rist-api-url');
    if (savedRistApiUrl) setRistApiUrlState(savedRistApiUrl);

    const savedServices = localStorage.getItem('enabled-services');
    if (savedServices) {
      try { setEnabledServicesState(JSON.parse(savedServices)); } catch {}
    }
  }, []);

  const setAdvancedMode = (enabled: boolean) => {
    setAdvancedModeState(enabled);
    localStorage.setItem('srt-advanced-mode', enabled.toString());
  };

  const setRistApiUrl = (url: string) => {
    setRistApiUrlState(url);
    localStorage.setItem('rist-api-url', url);
  };

  const setEnabledServices = (services: ServiceType[]) => {
    setEnabledServicesState(services);
    localStorage.setItem('enabled-services', JSON.stringify(services));
  };

  return (
    <SettingsContext.Provider value={{
      advancedMode, setAdvancedMode,
      ristApiUrl, setRistApiUrl,
      enabledServices, setEnabledServices,
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

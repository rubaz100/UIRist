import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import config from '../config';

// Settings context interface
interface SettingsContextType {
  advancedMode: boolean;
  setAdvancedMode: (enabled: boolean) => void;
  ristMetricsUrl: string;
  setRistMetricsUrl: (url: string) => void;
}

// Create context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Settings Provider component
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [advancedMode, setAdvancedModeState] = useState<boolean>(false);
  const [ristMetricsUrl, setRistMetricsUrlState] = useState<string>(config.ristMetricsUrl);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedAdvancedMode = localStorage.getItem('srt-advanced-mode');
    if (savedAdvancedMode === 'true') {
      setAdvancedModeState(true);
    }
    const savedRistUrl = localStorage.getItem('rist-metrics-url');
    if (savedRistUrl) {
      setRistMetricsUrlState(savedRistUrl);
    }
  }, []);

  // Set advanced mode and save to localStorage
  const setAdvancedMode = (enabled: boolean) => {
    setAdvancedModeState(enabled);
    localStorage.setItem('srt-advanced-mode', enabled.toString());
  };

  const setRistMetricsUrl = (url: string) => {
    setRistMetricsUrlState(url);
    localStorage.setItem('rist-metrics-url', url);
  };

  return (
    <SettingsContext.Provider
      value={{
        advancedMode,
        setAdvancedMode,
        ristMetricsUrl,
        setRistMetricsUrl,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook to use settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api.service';
import { ristApiService } from '../services/rist-api.service';

// Authentication context interface
interface AuthContextType {
  apiKey: string | null;
  isAuthenticated: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  // Sync API key changes to the persisted backend config (best-effort)
  const syncToBackend = async (key: string) => {
    try {
      const apiUrl = localStorage.getItem('rist-api-url');
      if (!apiUrl || apiUrl.startsWith('{{')) return;
      const ristKey = localStorage.getItem('rist-api-key') || '';
      ristApiService.setBaseUrl(apiUrl);
      ristApiService.setApiKey(ristKey);
      await ristApiService.savePersistedConfig({ srtApiKey: key });
    } catch (err: any) {
      console.warn('Failed to sync SRT API key to backend:', err?.message);
    }
  };

  // Load API key from localStorage on mount + listen for storage events
  // (SettingsContext may dispatch one after loading config from backend)
  useEffect(() => {
    const savedApiKey = localStorage.getItem('srt-api-key');
    if (savedApiKey) {
      setApiKeyState(savedApiKey);
      apiService.setApiKey(savedApiKey);
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'srt-api-key') return;
      const newKey = e.newValue || '';
      setApiKeyState(newKey || null);
      apiService.setApiKey(newKey);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Set API key and save to localStorage + backend
  const setApiKey = (key: string) => {
    setApiKeyState(key);
    apiService.setApiKey(key);
    localStorage.setItem('srt-api-key', key);
    syncToBackend(key);
  };

  // Clear API key
  const clearApiKey = () => {
    setApiKeyState(null);
    apiService.setApiKey('');
    localStorage.removeItem('srt-api-key');
    syncToBackend('');
  };

  return (
    <AuthContext.Provider
      value={{
        apiKey,
        isAuthenticated: !!apiKey,
        setApiKey,
        clearApiKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

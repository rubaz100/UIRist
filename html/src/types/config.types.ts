// Persisted configuration shared between frontend SettingsContext / AuthContext
// and the backend `/data/config.json` file.

export interface PersistedConfig {
  srtApiKey: string;
  ristApiKey: string;
  ristApiUrl: string;
  ristServerHost: string;
  flowHistoryTimeout: number;
  advancedMode: boolean;
  developerMode: boolean;
  showQrCodes: boolean;
}

export interface ConfigResponse {
  config: PersistedConfig;
  error: string | null;
  configFile: string;
}

/** AES-256-GCM encrypted config envelope (output of /api/config/export) */
export interface EncryptedEnvelope {
  version: number;
  algorithm: string;
  iterations: number;
  salt: string;        // base64
  iv: string;          // base64
  tag: string;         // base64
  ciphertext: string;  // base64
  exportedAt: string;  // ISO 8601
}

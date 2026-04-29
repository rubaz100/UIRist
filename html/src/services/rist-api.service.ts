import axios, { AxiosRequestConfig } from 'axios';
import {
  RistReceiver,
  RistRelay,
  RistStatsResponse,
  RistFlow,
  CreateReceiverPayload,
  UpdateReceiverPayload,
  HealthResponse,
  PortCheckResponse,
  UsedPortsResponse,
  PersistedConfig,
  ConfigResponse,
  EncryptedEnvelope,
} from '../types';

// Re-export so existing deep imports keep working during the refactor.
// New code should import from '../types'.
export type {
  CreateReceiverPayload,
  UpdateReceiverPayload,
  HealthResponse,
  PersistedConfig,
  ConfigResponse,
  EncryptedEnvelope,
};

const REQUEST_TIMEOUT_MS = 8000;

class RistApiService {
  private baseUrl: string = '';
  private apiKey: string = '';

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private opts(extra?: AxiosRequestConfig): AxiosRequestConfig {
    const headers = this.apiKey ? { 'X-API-Key': this.apiKey } : {};
    return { ...extra, headers: { ...headers, ...(extra?.headers || {}) }, timeout: REQUEST_TIMEOUT_MS };
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Health ────────────────────────────────────────────────────────────
  async getHealth(): Promise<HealthResponse> {
    const res = await axios.get<HealthResponse>(this.url('/health'), this.opts());
    return res.data;
  }

  // ── Receivers ─────────────────────────────────────────────────────────
  async getReceivers(): Promise<RistReceiver[]> {
    const res = await axios.get<RistReceiver[]>(this.url('/api/receivers'), this.opts());
    return res.data;
  }

  async createReceiver(payload: CreateReceiverPayload): Promise<RistReceiver> {
    const res = await axios.post<RistReceiver>(this.url('/api/receivers'), payload, this.opts());
    return res.data;
  }

  async updateReceiver(id: string, payload: UpdateReceiverPayload): Promise<RistReceiver> {
    const res = await axios.put<RistReceiver>(this.url(`/api/receivers/${id}`), payload, this.opts());
    return res.data;
  }

  async deleteReceiver(id: string): Promise<void> {
    await axios.delete(this.url(`/api/receivers/${id}`), this.opts());
  }

  async getReceiverLogs(id: string): Promise<string[]> {
    const res = await axios.get<{ logs: string[] }>(this.url(`/api/receivers/${id}/logs`), this.opts());
    return res.data.logs;
  }

  async getReceiverStats(id: string): Promise<RistFlow[]> {
    const res = await axios.get<RistStatsResponse>(this.url(`/api/receivers/${id}/stats`), this.opts());
    return res.data.flows;
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  async getStats(): Promise<RistFlow[]> {
    const res = await axios.get<RistStatsResponse>(this.url('/api/stats'), this.opts());
    return res.data.flows;
  }

  // ── Ports ─────────────────────────────────────────────────────────────
  async checkPort(port: number): Promise<PortCheckResponse> {
    const res = await axios.get<PortCheckResponse>(this.url('/api/ports/check'), this.opts({ params: { port } }));
    return res.data;
  }

  async getUsedPorts(): Promise<UsedPortsResponse> {
    const res = await axios.get<UsedPortsResponse>(this.url('/api/ports/used'), this.opts());
    return res.data;
  }

  // ── Relay ─────────────────────────────────────────────────────────────
  async startRelay(receiverId: string, srtPort: number, passphrase?: string): Promise<RistRelay> {
    const res = await axios.post<RistRelay>(this.url(`/api/receivers/${receiverId}/relay`), { srtPort, passphrase }, this.opts());
    return res.data;
  }

  async stopRelay(receiverId: string): Promise<void> {
    await axios.delete(this.url(`/api/receivers/${receiverId}/relay`), this.opts());
  }

  async getRelayLogs(receiverId: string): Promise<string[]> {
    const res = await axios.get<{ logs: string[] }>(this.url(`/api/receivers/${receiverId}/relay/logs`), this.opts());
    return res.data.logs;
  }

  // ── Config persistence ─────────────────────────────────────────────────
  async getPersistedConfig(): Promise<ConfigResponse> {
    const res = await axios.get<ConfigResponse>(this.url('/api/config'), this.opts());
    return res.data;
  }

  async savePersistedConfig(updates: Partial<PersistedConfig>): Promise<ConfigResponse> {
    const res = await axios.put<ConfigResponse>(this.url('/api/config'), updates, this.opts());
    return res.data;
  }

  async exportConfig(password: string): Promise<EncryptedEnvelope> {
    const res = await axios.post<EncryptedEnvelope>(this.url('/api/config/export'), { password }, this.opts());
    return res.data;
  }

  async importConfig(envelope: EncryptedEnvelope, password: string): Promise<ConfigResponse> {
    const res = await axios.post<ConfigResponse>(this.url('/api/config/import'), { envelope, password }, this.opts());
    return res.data;
  }
}

export const ristApiService = new RistApiService();

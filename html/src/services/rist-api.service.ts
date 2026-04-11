import axios from 'axios';
import { RistReceiver, RistStatsResponse } from '../types/rist-receiver.types';
import { RistFlow } from '../types/rist.types';

export interface CreateReceiverPayload {
  name?: string;
  listenPort: number;
  outputUrl: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  ristreceiver: { available: boolean; path: string | null };
}

class RistApiService {
  private baseUrl: string = '';
  private apiKey: string = '';

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private headers() {
    return this.apiKey ? { 'X-API-Key': this.apiKey } : {};
  }

  private opts() {
    return { headers: this.headers(), timeout: 8000 };
  }

  async getHealth(): Promise<HealthResponse> {
    const res = await axios.get<HealthResponse>(`${this.baseUrl}/health`, this.opts());
    return res.data;
  }

  async getReceivers(): Promise<RistReceiver[]> {
    const res = await axios.get<RistReceiver[]>(`${this.baseUrl}/api/receivers`, this.opts());
    return res.data;
  }

  async createReceiver(payload: CreateReceiverPayload): Promise<RistReceiver> {
    const res = await axios.post<RistReceiver>(`${this.baseUrl}/api/receivers`, payload, this.opts());
    return res.data;
  }

  async deleteReceiver(id: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/api/receivers/${id}`, this.opts());
  }

  async getStats(): Promise<RistFlow[]> {
    const res = await axios.get<RistStatsResponse>(`${this.baseUrl}/api/stats`, this.opts());
    return res.data.flows;
  }

  async getReceiverStats(id: string): Promise<RistFlow[]> {
    const res = await axios.get<RistStatsResponse>(`${this.baseUrl}/api/receivers/${id}/stats`, this.opts());
    return res.data.flows;
  }

  async getReceiverLogs(id: string): Promise<string[]> {
    const res = await axios.get<{ logs: string[] }>(`${this.baseUrl}/api/receivers/${id}/logs`, this.opts());
    return res.data.logs;
  }

  async checkPort(port: number): Promise<{ port: number; available: boolean; reserved: boolean; usedByReceiver: boolean }> {
    const res = await axios.get(`${this.baseUrl}/api/ports/check`, { ...this.opts(), params: { port } });
    return res.data;
  }

  async getUsedPorts(): Promise<{ receiverPorts: number[]; reservedPorts: number[] }> {
    const res = await axios.get(`${this.baseUrl}/api/ports/used`, this.opts());
    return res.data;
  }
}

export const ristApiService = new RistApiService();

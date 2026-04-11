export interface RistReceiver {
  id: string;
  name: string;
  listenPort: number;
  outputUrl: string;
  metricsPort: number;
  metricsUrl: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  pid: number | null;
  createdAt: string;
  error?: string;
}

export interface RistStatsResponse {
  flows: import('./rist.types').RistFlow[];
}

export interface RistRelay {
  receiverId: string;
  udpPort: number;
  srtPort: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  pid: number | null;
  error?: string;
}

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
  relay: RistRelay | null;
}

export interface RistStatsResponse {
  flows: import('./rist.types').RistFlow[];
}

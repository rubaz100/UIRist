// Request payloads sent to the RIST API.

export interface CreateReceiverPayload {
  name?: string;
  listenPort: number;
  outputUrl: string;
  secret?: string;
}

export interface UpdateReceiverPayload {
  name?: string;
  secret?: string;
  outputUrl?: string;
}

export interface StartRelayPayload {
  srtPort: number;
  passphrase?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  ristreceiver: { available: boolean; path: string | null };
}

export interface PortCheckResponse {
  port: number;
  available: boolean;
  reserved: boolean;
  usedByReceiver: boolean;
  outOfRange?: boolean;
  allowedRange?: { min: number; max: number };
}

export interface UsedPortsResponse {
  receiverPorts: number[];
  reservedPorts: number[];
}

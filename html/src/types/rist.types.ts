export interface RistPeer {
  id: number;
  dead: number;          // 0 = active, 1 = dead
  rtt: number;           // ms
  avgRtt: number;        // ms
  bitrate: number;       // bps
  avgBitrate: number;    // bps
  // Populated by the backend when libRIST emits a peer_name label on its
  // metrics socket. Null until the first metrics push arrives.
  ip?: string | null;
  // Populated asynchronously after the backend's ISP lookup resolves. Null
  // while the lookup is pending or if the upstream provider failed.
  isp?: string | null;
  // ISO-3166 alpha-2 country code (e.g. "DE"). UI renders a flag emoji from it.
  country?: string | null;
}

export interface RistFlow {
  flowId: string;
  peerName: string;
  receiverId?: string;
  receiverName?: string;
  qualityRatio: number;      // 0.0 – 1.0
  packetsReceived: number;
  packetsRecovered: number;
  packetsLost: number;
  bitrate: number;           // bps (flow-level)
  avgBufferTime: number;     // ms
  peers: RistPeer[];
}

/** A flow that has gone inactive and moved to history */
export interface HistoryFlow extends RistFlow {
  disappearedAt: number;   // Unix timestamp ms
}

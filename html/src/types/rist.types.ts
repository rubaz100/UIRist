export interface RistPeer {
  id: number;
  dead: number;          // 0 = active, 1 = dead
  rtt: number;           // ms
  avgRtt: number;        // ms
  bitrate: number;       // bps
  avgBitrate: number;    // bps
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

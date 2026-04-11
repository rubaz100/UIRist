export interface RistFlow {
  flowId: string;
  peerName: string;
  receiverId?: string;
  receiverName?: string;
  qualityRatio: number;      // 0.0 – 1.0
  packetsReceived: number;
  packetsRecovered: number;
  packetsLost: number;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { RistFlow } from '../types';

const MAX_SAMPLES = 60; // ~5 min at one sample per refresh (5 s)

/**
 * Tracks bitrate history per peer for a single flow. Appends a fresh sample
 * every time the `flow` prop reference changes — which happens once per poll
 * cycle in the parent's `useRistStats` hook.
 *
 * History is held in a ref to survive re-renders, plus a `version` state that
 * bumps whenever new samples land (so consumers re-render with fresh data).
 *
 * Returns:
 *   - `getSamples(peerId)`   read-only access to a peer's sample list
 *   - `reset()`              wipe all peer histories for this flow
 */
export function usePeerBitrateHistory(flow: RistFlow) {
  const histories = useRef(new Map<number, number[]>());
  const [, setVersion] = useState(0);

  useEffect(() => {
    // Append the current bitrate for every peer in this snapshot.
    // Dead peers still get a sample (usually 0) so the graph shows the drop.
    for (const peer of flow.peers ?? []) {
      const existing = histories.current.get(peer.id) ?? [];
      const next = [...existing, peer.bitrate];
      if (next.length > MAX_SAMPLES) next.splice(0, next.length - MAX_SAMPLES);
      histories.current.set(peer.id, next);
    }

    // Drop history for peers that no longer appear in this flow
    const livePeerIds = new Set((flow.peers ?? []).map(p => p.id));
    for (const id of Array.from(histories.current.keys())) {
      if (!livePeerIds.has(id)) histories.current.delete(id);
    }

    setVersion(v => v + 1);
  }, [flow]);

  const getSamples = useCallback((peerId: number): number[] => {
    return histories.current.get(peerId) ?? [];
  }, []);

  const reset = useCallback(() => {
    histories.current.clear();
    setVersion(v => v + 1);
  }, []);

  return { getSamples, reset };
}

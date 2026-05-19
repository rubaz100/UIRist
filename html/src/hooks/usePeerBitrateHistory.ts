import { useCallback, useEffect, useRef, useState } from 'react';
import { RistFlow } from '../types';

const MAX_SAMPLES = 60; // ~5 min at one sample per refresh (5 s)

// localStorage scheme
const LS_PREFIX = 'rist-bitrate:v1';
const LS_KEY_RE = /^rist-bitrate:v1:/;
// Entries idle for longer than this get pruned on next hook mount.
const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * Per-entry shape stored in localStorage. `lastUpdated` lets us auto-evict
 * stale entries on the next page load without a background timer.
 */
interface StoredEntry {
  samples: number[];
  lastUpdated: number;
}

const flowKeyOf = (flow: RistFlow) => `${flow.receiverId ?? ''}-${flow.flowId}`;
const lsKey = (flowKey: string, peerId: number) => `${LS_PREFIX}:${flowKey}:${peerId}`;

function readEntry(key: string): StoredEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.samples) || typeof parsed.lastUpdated !== 'number') {
      return null;
    }
    return parsed as StoredEntry;
  } catch {
    return null;
  }
}

function writeEntry(key: string, entry: StoredEntry) {
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // QuotaExceededError or private-mode storage disabled — silently skip.
    // We're a graph UI, not a database; in-memory state still works.
  }
}

function removeEntry(key: string) {
  try { localStorage.removeItem(key); } catch {}
}

/**
 * Global one-shot pass: drop every `rist-bitrate:v1:*` key whose `lastUpdated`
 * is older than STALE_AFTER_MS. Runs once per page load (module level), not per
 * component mount, so it never blocks rendering.
 */
let cleanupRan = false;
function runStaleCleanup() {
  if (cleanupRan) return;
  cleanupRan = true;
  try {
    const now = Date.now();
    const keysToDrop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !LS_KEY_RE.test(k)) continue;
      const entry = readEntry(k);
      if (!entry || now - entry.lastUpdated > STALE_AFTER_MS) {
        keysToDrop.push(k);
      }
    }
    for (const k of keysToDrop) removeEntry(k);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Tracks bitrate history per peer for a single flow. Persists samples in
 * localStorage so a page refresh restores the graph instead of starting blank.
 *
 * Sample append happens once per poll cycle (when the parent's `flow` reference
 * changes). Dead peers still get a sample appended so the graph shows when
 * traffic stopped.
 *
 * Cleanup is two-tier:
 *  • Entries idle for over an hour are pruned on next page load.
 *  • Peers that disappear from the flow get their entry pruned immediately.
 */
export function usePeerBitrateHistory(flow: RistFlow) {
  const histories = useRef(new Map<number, number[]>());
  const [, setVersion] = useState(0);
  const flowKey = flowKeyOf(flow);

  // One-shot hydration from localStorage on first mount. Synchronous so the
  // graph isn't blank for a render before history loads.
  const hydratedRef = useRef(false);
  if (!hydratedRef.current) {
    hydratedRef.current = true;
    runStaleCleanup();
    try {
      // Walk every key that matches this flow's prefix and seed the ref.
      const prefix = `${LS_PREFIX}:${flowKey}:`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        const peerId = Number(k.slice(prefix.length));
        if (!Number.isFinite(peerId)) continue;
        const entry = readEntry(k);
        if (entry) histories.current.set(peerId, entry.samples.slice(-MAX_SAMPLES));
      }
    } catch { /* storage unavailable */ }
  }

  useEffect(() => {
    const now = Date.now();

    // Append the current bitrate for every peer in this snapshot.
    for (const peer of flow.peers ?? []) {
      const existing = histories.current.get(peer.id) ?? [];
      const next = [...existing, peer.bitrate];
      if (next.length > MAX_SAMPLES) next.splice(0, next.length - MAX_SAMPLES);
      histories.current.set(peer.id, next);
      writeEntry(lsKey(flowKey, peer.id), { samples: next, lastUpdated: now });
    }

    // Drop history for peers that no longer appear in this flow.
    const livePeerIds = new Set((flow.peers ?? []).map(p => p.id));
    for (const id of Array.from(histories.current.keys())) {
      if (!livePeerIds.has(id)) {
        histories.current.delete(id);
        removeEntry(lsKey(flowKey, id));
      }
    }

    setVersion(v => v + 1);
  }, [flow, flowKey]);

  const getSamples = useCallback((peerId: number): number[] => {
    return histories.current.get(peerId) ?? [];
  }, []);

  const reset = useCallback(() => {
    // Wipe in-memory AND every localStorage entry that belongs to this flow,
    // not just the ones currently in `histories.current` (defensive — covers
    // entries hydrated from a previous session).
    histories.current.clear();
    try {
      const prefix = `${LS_PREFIX}:${flowKey}:`;
      const toDrop: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toDrop.push(k);
      }
      for (const k of toDrop) removeEntry(k);
    } catch { /* storage unavailable */ }
    setVersion(v => v + 1);
  }, [flowKey]);

  return { getSamples, reset };
}

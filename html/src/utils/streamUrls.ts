// Helpers for building RIST input URLs and SRT pull URLs shown on the receiver card.
// Centralising them avoids subtle drift between display, copy, and QR-code values.

const MASK = '•'.repeat(12);
// OBS treats `latency` as microseconds, so a 2-second latency is 2,000,000.
// The relay process itself receives `latency=2000` (milliseconds) — see relayManager.js.
const OBS_LATENCY_US = 2_000_000;

export interface RistUrlOptions {
  host: string;
  port: number;
  secret?: string;
}

/** Real RIST input URL (secret embedded). Port is always included — the listener
 *  binds to a specific UDP port, so the sender needs it. */
export function buildRistUrl({ host, port, secret }: RistUrlOptions): string {
  const base = `rist://${host}:${port}`;
  return secret ? `${base}?secret=${secret}` : base;
}

/** Same URL but with the secret masked — for display only. */
export function buildRistUrlMasked({ host, port, secret }: RistUrlOptions): string {
  const base = `rist://${host}:${port}`;
  return secret ? `${base}?secret=${MASK}` : base;
}

export interface SrtUrlOptions {
  host: string;
  port: number;
  passphrase?: string;
}

/** Real OBS SRT pull URL (passphrase embedded, latency in microseconds). */
export function buildSrtObsUrl({ host, port, passphrase }: SrtUrlOptions): string {
  const base = `srt://${host}:${port}`;
  return passphrase
    ? `${base}?passphrase=${passphrase}&latency=${OBS_LATENCY_US}`
    : `${base}?latency=${OBS_LATENCY_US}`;
}

/** Same OBS URL but with the passphrase masked. */
export function buildSrtObsUrlMasked({ host, port, passphrase }: SrtUrlOptions): string {
  const base = `srt://${host}:${port}`;
  return passphrase
    ? `${base}?passphrase=${MASK}&latency=${OBS_LATENCY_US}`
    : `${base}?latency=${OBS_LATENCY_US}`;
}

/**
 * NOALBS OpenIRL stats URL. Auto-derived from the public RIST server host + the
 * API port (parsed from the API base URL the UI talks to). The path uses
 * `play_<id>` with dashes stripped to match the conventional OpenIRL format.
 *
 *   http://ingest.example.com:3001/stats/play_ead95cd40bc344ff8d5a4ac7f3e58028
 */
export function buildNoalbsStatsUrl(apiUrl: string, publicHost: string, receiverId: string): string {
  let scheme = 'http';
  let port = '3001';
  try {
    const parsed = new URL(apiUrl);
    scheme = parsed.protocol.replace(':', '') || 'http';
    port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch {
    // fall through to defaults
  }
  const host = publicHost && publicHost.trim() ? publicHost.trim() : 'localhost';
  const streamKey = receiverId.replace(/-/g, '');
  return `${scheme}://${host}:${port}/stats/play_${streamKey}`;
}

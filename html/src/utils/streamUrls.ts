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

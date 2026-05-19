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
  /** Show port explicitly. Default false — sender just needs hostname when not on a custom port. */
  showPort?: boolean;
}

/** Real RIST input URL (secret embedded). */
export function buildRistUrl({ host, port, secret, showPort }: RistUrlOptions): string {
  const base = showPort ? `rist://${host}:${port}` : `rist://${host}`;
  return secret ? `${base}?secret=${secret}` : base;
}

/** Same URL but with the secret masked — for display only. */
export function buildRistUrlMasked({ host, port, secret, showPort }: RistUrlOptions): string {
  const base = showPort ? `rist://${host}:${port}` : `rist://${host}`;
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

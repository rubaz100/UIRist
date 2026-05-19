// Convert an ISO-3166-1 alpha-2 country code (e.g. "DE", "US") to a flag emoji.
// The flag glyphs are Regional Indicator Symbols — code points 0x1F1E6..0x1F1FF —
// which when paired by the renderer form the country flag.
//
// Returns null on invalid input so callers can fall back gracefully.

export function countryCodeToFlag(code: string | null | undefined): string | null {
  if (!code || code.length !== 2) return null;
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  const base = 0x1F1E6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(upper.charCodeAt(0) + base, upper.charCodeAt(1) + base);
}

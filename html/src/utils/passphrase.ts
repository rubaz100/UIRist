// Cryptographically random passphrase / secret generation.
// All values stay browser-side; nothing is sent to a server.

// Unambiguous Base58-like alphabet — drops 0/O/I/l/1 to avoid copy-paste mistakes.
const READABLE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * Generate a random secret using a readable Base58-style alphabet.
 * Default length 20 → ~117 bits of entropy, well above PSK requirements.
 *
 * Used for both RIST PSK secrets (8–64 chars) and SRT passphrases (10–79 chars).
 */
export function generateSecret(length: number = 20): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += READABLE_ALPHABET[buf[i] % READABLE_ALPHABET.length];
  }
  return out;
}

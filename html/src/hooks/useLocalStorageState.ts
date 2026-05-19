import { useState, useCallback } from 'react';

/**
 * Read/write/parse helpers for the supported value shapes. Kept tiny on purpose —
 * we only persist booleans, strings, and numbers in this app's settings.
 */
function decode<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  if (typeof fallback === 'boolean') return (raw === 'true') as unknown as T;
  if (typeof fallback === 'number') {
    const n = Number(raw);
    return (Number.isFinite(n) ? n : fallback) as unknown as T;
  }
  return raw as unknown as T;
}

function encode<T>(value: T): string {
  return typeof value === 'string' ? value : String(value);
}

/**
 * Persistent React state mirrored to `localStorage` under the given key.
 *
 * Reads synchronously during initial render so the UI starts with the saved
 * value (no flicker), and writes on every update.
 *
 * @param key      localStorage key
 * @param initial  fallback value when the key is unset or storage is unavailable
 */
export function useLocalStorageState<T extends string | number | boolean>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return decode(localStorage.getItem(key), initial);
    } catch {
      return initial; // storage disabled / private mode
    }
  });

  const update = useCallback((next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, encode(next));
    } catch {
      /* ignore quota / disabled-storage errors */
    }
  }, [key]);

  return [value, update];
}

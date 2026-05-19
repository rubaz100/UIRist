import { useState, useEffect } from 'react';

export const useRefreshTimer = (
  onExpire: () => void | Promise<void> = (): void => undefined,
  refreshInterval: number,
) => {
  const normalizedInterval = Math.max(0, refreshInterval);
  const [secondsUntilUpdate, setSecondsUntilUpdate] = useState(normalizedInterval);

  useEffect(() => {
    setSecondsUntilUpdate(normalizedInterval);
  }, [normalizedInterval]);

  useEffect(() => {
    if (normalizedInterval === 0) {
      let cancelled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const tick = async () => {
        setSecondsUntilUpdate(0);
        try {
          await Promise.resolve(onExpire());
        } catch {
          // The called hook owns user-facing error state; keep the timer alive.
        } finally {
          if (!cancelled) timeout = setTimeout(tick, 0);
        }
      };

      timeout = setTimeout(tick, 0);
      return () => {
        cancelled = true;
        if (timeout) clearTimeout(timeout);
      };
    }

    const countdownInterval = setInterval(() => {
      if (secondsUntilUpdate === 1) {
        onExpire();
        setSecondsUntilUpdate(normalizedInterval);
        return;
      }

      setSecondsUntilUpdate(secondsUntilUpdate - 1);
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [secondsUntilUpdate, setSecondsUntilUpdate, normalizedInterval, onExpire])

  return secondsUntilUpdate;
};

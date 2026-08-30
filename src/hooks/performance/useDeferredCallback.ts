import { useEffect, useRef } from 'react';

/**
 * Runs `callback` once `timeout` elapses, so background work starts past the
 * startup hot zone. A plain timeout on purpose: `requestIdleCallback` adds
 * nothing after a long delay and is unreliable on iOS (RN #28602).
 */
export function useDeferredCallback(
  callback: () => void,
  enabled: boolean = true,
  timeout: number = 1000,
): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      callbackRef.current();
    }, timeout);

    return () => clearTimeout(timer);
  }, [enabled, timeout]);
}

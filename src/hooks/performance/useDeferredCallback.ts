import { useEffect, useRef } from 'react';

/**
 * Defers a callback execution using a simple timeout.
 *
 * Waits for the specified timeout to elapse before executing the callback.
 * This ensures we're past the startup hot zone before running background work.
 *
 * Previously used a two-phase approach (setTimeout + requestIdleCallback),
 * but the inner requestIdleCallback added negligible value after long timeouts
 * and had iOS reliability issues (RN #28602).
 *
 * @param callback - Function to call after timeout
 * @param enabled - Whether the callback should run (default: true)
 * @param timeout - Time to wait before execution (default: 1000ms)
 *
 * @example
 * ```tsx
 * // Run heavy work after screen settles
 * useDeferredCallback(() => {
 *   fetchBackgroundData();
 * }, isAuthenticated && isOnline, 5000);
 * ```
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

import { useEffect, useRef } from 'react';

/**
 * Defers a callback using a two-phase approach: setTimeout + requestIdleCallback.
 *
 * Phase 1: Wait for the minimum timeout to elapse (ensures we're past the startup hot zone).
 * Phase 2: Wait for the JS thread to be idle (avoids competing with active renders/interactions).
 *
 * This is more reliable than requestIdleCallback alone (which is timer-based on iOS
 * due to RN issue #28602) and ensures a guaranteed minimum delay before execution.
 *
 * @param callback - Function to call when idle
 * @param enabled - Whether the callback should run (default: true)
 * @param timeout - Minimum time to wait before execution (default: 1000ms)
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
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let idleId: ReturnType<typeof requestIdleCallback> | null = null;

    // Phase 1: Wait for minimum timeout
    const timer = setTimeout(() => {
      // Phase 2: Wait for JS thread to be idle
      idleId = requestIdleCallback(
        () => {
          if (!cancelled) {
            callbackRef.current();
          }
        },
        { timeout: 1000 },
      );
    }, timeout);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (idleId !== null) {
        cancelIdleCallback(idleId);
      }
    };
  }, [enabled, timeout]);
}

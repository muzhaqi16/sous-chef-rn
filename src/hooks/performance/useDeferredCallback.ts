import { useEffect, useRef } from 'react';

/**
 * Defers a callback until the runtime is idle.
 * Production-ready replacement for InteractionManager.runAfterInteractions.
 *
 * Unlike setTimeout, this is event-driven: it triggers when the
 * JavaScript runtime has no pending work, naturally yielding to
 * user interactions, animations, and navigation.
 *
 * IMPORTANT: On iOS, requestIdleCallback may never fire without a timeout.
 * See: https://github.com/facebook/react-native/issues/28602
 * The timeout parameter ensures the callback fires on iOS.
 *
 * @param callback - Function to call when idle
 * @param enabled - Whether the callback should run (default: true)
 * @param timeout - Max time to wait before forcing execution (default: 1000ms)
 *
 * @example
 * ```tsx
 * // Run heavy work after screen settles
 * useDeferredCallback(() => {
 *   fetchBackgroundData();
 * }, isAuthenticated && isOnline);
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

    const idleId = requestIdleCallback(
      () => {
        callbackRef.current();
      },
      { timeout },
    );

    return () => cancelIdleCallback(idleId);
  }, [enabled, timeout]);
}

import { useEffect, useRef } from 'react';

/**
 * Hook that defers a callback until after navigation animations complete.
 *
 * Uses requestIdleCallback() to ensure heavy work (data fetches, expensive
 * computations) doesn't interfere with navigation transitions.
 *
 * @param callback - Function to run after interactions complete
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * function MyScreen() {
 *   useAfterInteraction(() => {
 *     // Heavy data fetch that should wait for animation to finish
 *     fetchLargeDataset();
 *   });
 *   return <View>...</View>;
 * }
 * ```
 */
export function useAfterInteraction(
  callback: () => void | (() => void),
  options?: {
    /** Gate to enable/disable (default: true) */
    enabled?: boolean;
  },
) {
  const enabled = options?.enabled ?? true;
  const callbackRef = useRef(callback);

  // Keep callback ref fresh to avoid stale closures
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    // Defer until JS thread is idle — fires after navigation animations settle
    const handle = requestIdleCallback(() => {
      callbackRef.current();
    });

    return () => cancelIdleCallback(handle);
  }, [enabled]);
}

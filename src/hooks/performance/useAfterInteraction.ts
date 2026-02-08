import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Hook that defers a callback until after navigation animations complete.
 *
 * Uses InteractionManager.runAfterInteractions() to ensure heavy work
 * (data fetches, expensive computations) doesn't interfere with
 * navigation transitions.
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

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- runAfterInteractions is still the recommended approach per RN docs
    const task = InteractionManager.runAfterInteractions(() => {
      callbackRef.current();
    });

    return () => task.cancel();
  }, [enabled]);
}

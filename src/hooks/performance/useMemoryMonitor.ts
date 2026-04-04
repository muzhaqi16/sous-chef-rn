import { useEffect, useRef } from 'react';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';

/**
 * Hook to monitor memory usage for a component
 *
 * Tracks memory before and after component mount to identify memory leaks
 * or excessive memory usage.
 *
 * @param componentName - Name of the component being tracked
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * function ImageHeavyComponent() {
 *   useMemoryMonitor('ImageHeavyComponent');
 *   return <View>...</View>;
 * }
 * ```
 */
export function useMemoryMonitor(
  componentName: string,
  options?: {
    enabled?: boolean;
    trackMount?: boolean;
    trackUnmount?: boolean;
  },
) {
  const mountMemory = useRef<number | null>(null);
  const enabled = options?.enabled ?? __DEV__;
  const trackMount = options?.trackMount ?? true;
  const trackUnmount = options?.trackUnmount ?? true;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    // Track memory on mount
    if (trackMount) {
      MemoryMonitor.takeSnapshot(`${componentName}_mount`).then(snapshot => {
        if (cancelled) return;
        if (snapshot) {
          mountMemory.current = snapshot.usedBytes;

          if (__DEV__) {
            console.log(
              `[MemoryMonitor] ${componentName} mounted - Memory: ${(
                snapshot.usedBytes /
                1024 /
                1024
              ).toFixed(2)}MB`,
            );
          }
        }
      });
    }

    // Track memory on unmount
    return () => {
      cancelled = true;
      if (!enabled || !trackUnmount) {
        return;
      }

      // Unmount snapshot is fire-and-forget — the component is already gone,
      // so there is no state to guard. Only the mount snapshot needs the
      // cancelled flag (above) to avoid writing to a stale ref.
      MemoryMonitor.takeSnapshot(`${componentName}_unmount`).then(snapshot => {
        if (snapshot && mountMemory.current !== null) {
          const memoryDelta = snapshot.usedBytes - mountMemory.current;
          const memoryDeltaMB = memoryDelta / 1024 / 1024;

          if (__DEV__) {
            const sign = memoryDelta >= 0 ? '+' : '';
            console.log(
              `[MemoryMonitor] ${componentName} unmounted - Memory delta: ${sign}${memoryDeltaMB.toFixed(
                2,
              )}MB`,
            );

            // Warn if significant memory growth
            if (memoryDeltaMB > 10) {
              console.warn(
                `[MemoryMonitor] Potential memory leak in ${componentName}: ${memoryDeltaMB.toFixed(
                  2,
                )}MB not released`,
              );
            }
          }
        }
      });
    };
  }, [componentName, enabled, trackMount, trackUnmount]);
}

/**
 * Hook to get current memory snapshot
 *
 * Returns the latest memory snapshot from the monitor.
 *
 * @returns Latest memory snapshot or null
 *
 * @example
 * ```typescript
 * function MemoryDisplay() {
 *   const snapshot = useCurrentMemory();
 *   return <Text>Memory: {snapshot?.usagePercent}%</Text>;
 * }
 * ```
 */
export function useCurrentMemory() {
  return MemoryMonitor.getLatestSnapshot();
}

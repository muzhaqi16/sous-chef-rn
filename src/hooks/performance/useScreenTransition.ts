import { useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';
import { logger } from '#/utils/environment';

/**
 * Safely measures the duration between two performance marks.
 * Returns the duration in ms, or 0 if the marks have been cleared.
 */
function safeMeasure(
  measureName: string,
  startMark: string,
  endMark: string,
): number {
  try {
    const measure = performance.measure(measureName, startMark, endMark);
    return measure?.duration ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Safely measures the duration between two performance marks.
 * Returns the duration, or null if the marks have been cleared
 * (signaling the caller should abort further processing).
 */
function safeMeasureOrAbort(
  measureName: string,
  startMark: string,
  endMark: string,
): number | null {
  try {
    const measure = performance.measure(measureName, startMark, endMark);
    return measure?.duration ?? 0;
  } catch {
    return null;
  }
}

/**
 * Hook to track screen transition performance
 *
 * Measures navigation time and screen mount/interactive time using
 * `react-native-performance` marks and measures. The central observer
 * in `NativePerformanceService` picks up the measures and routes them
 * to telemetry histograms.
 *
 * @param screenName - Name of the screen being tracked
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * function MyScreen() {
 *   useScreenTransition('MyScreen');
 *   return <View>...</View>;
 * }
 * ```
 */
export function useScreenTransition(
  screenName: string,
  options?: {
    enabled?: boolean;
    trackMount?: boolean;
    trackInteractive?: boolean;
  },
): void {
  const focusMarkRef = useRef<string | null>(null);
  const mountMarkRef = useRef<string | null>(null);
  const mountDurationRef = useRef<number>(0);
  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
  const trackMount = options?.trackMount ?? true;
  const trackInteractive = options?.trackInteractive ?? true;

  // Track focus event (navigation to this screen)
  useFocusEffect(() => {
    if (!enabled) {
      return;
    }

    const focusMarkName = `screen:${screenName}:focus`;
    performance.mark(focusMarkName);
    focusMarkRef.current = focusMarkName;

    return () => {
      // Clean up marks on blur to prevent memory accumulation
      performance.clearMarks(`screen:${screenName}:focus`);
      performance.clearMarks(`screen:${screenName}:mounted`);
      performance.clearMarks(`screen:${screenName}:interactiveEnd`);
      focusMarkRef.current = null;
      mountMarkRef.current = null;
    };
  });

  // Track mount time
  useEffect(() => {
    if (!enabled || !trackMount || focusMarkRef.current === null) {
      return;
    }

    const mountMarkName = `screen:${screenName}:mounted`;
    performance.mark(mountMarkName);
    mountMarkRef.current = mountMarkName;

    // Measure focus -> mount (central observer routes to screen_mount_duration_ms)
    mountDurationRef.current = safeMeasure(
      `screen:${screenName}:mount`,
      focusMarkRef.current,
      mountMarkName,
    );

    // Mark screen as interactive after next frame
    if (trackInteractive) {
      requestAnimationFrame(() => {
        if (focusMarkRef.current === null) {
          return; // Screen already unmounted
        }

        const interactiveMarkName = `screen:${screenName}:interactiveEnd`;
        performance.mark(interactiveMarkName);

        // Measure focus -> interactive (central observer routes to screen_interactive_duration_ms)
        const interactiveDuration = safeMeasureOrAbort(
          `screen:${screenName}:interactive`,
          focusMarkRef.current,
          interactiveMarkName,
        );
        if (interactiveDuration === null) {
          return;
        }

        // Measure focus -> transition (central observer routes to screen_transition_duration_ms)
        safeMeasure(
          `screen:${screenName}:transition`,
          focusMarkRef.current,
          interactiveMarkName,
        );

        // Record metrics in performance store for dashboard (isolated from main store)
        usePerformanceStore
          .getState()
          .recordScreenTransition(
            screenName,
            mountDurationRef.current,
            interactiveDuration,
          );

        // Warn if slow transition
        if (interactiveDuration > 500) {
          logger.warn(
            `[ScreenTransition] Slow screen transition: ${screenName} took ${interactiveDuration.toFixed(
              2,
            )}ms`,
          );

          Telemetry.increment('slow_screen_transitions_total', 1, {
            screen: screenName,
            duration: interactiveDuration.toFixed(2),
          });
        }
      });
    }
  }, [enabled, screenName, trackMount, trackInteractive]);
}

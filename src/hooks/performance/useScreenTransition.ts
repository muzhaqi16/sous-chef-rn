import { useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';

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
) {
  const focusMarkRef = useRef<string | null>(null);
  const mountMarkRef = useRef<string | null>(null);
  const mountDurationRef = useRef<number>(0);
  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
  const trackMount = options?.trackMount ?? true;
  const trackInteractive = options?.trackInteractive ?? true;

  // Track focus event (navigation to this screen)
  useFocusEffect(
    () => {
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
    },
  );

  // Track mount time
  useEffect(() => {
    if (!enabled || !trackMount || focusMarkRef.current === null) {
      return;
    }

    const mountMarkName = `screen:${screenName}:mounted`;
    performance.mark(mountMarkName);
    mountMarkRef.current = mountMarkName;

    // Measure focus → mount (central observer routes to screen_mount_duration_ms)
    try {
      const measure = performance.measure(
        `screen:${screenName}:mount`,
        focusMarkRef.current,
        mountMarkName,
      );
      mountDurationRef.current = measure?.duration ?? 0;
    } catch {
      // Marks may have been cleared if screen blurred quickly
    }

    // Mark screen as interactive after next frame
    if (trackInteractive) {
      requestAnimationFrame(() => {
        if (focusMarkRef.current === null) {
          return; // Screen already unmounted
        }

        const interactiveMarkName = `screen:${screenName}:interactiveEnd`;
        performance.mark(interactiveMarkName);

        // Measure focus → interactive (central observer routes to screen_interactive_duration_ms)
        let interactiveDuration = 0;
        try {
          const interactiveMeasure = performance.measure(
            `screen:${screenName}:interactive`,
            focusMarkRef.current,
            interactiveMarkName,
          );
          interactiveDuration = interactiveMeasure?.duration ?? 0;
        } catch {
          return;
        }

        // Measure focus → transition (central observer routes to screen_transition_duration_ms)
        try {
          performance.measure(
            `screen:${screenName}:transition`,
            focusMarkRef.current,
            interactiveMarkName,
          );
        } catch {
          // Marks may have been cleared
        }

        // Record metrics in performance store for dashboard (isolated from main store)
        usePerformanceStore.getState().recordScreenTransition(
          screenName,
          mountDurationRef.current,
          interactiveDuration,
        );

        // Warn if slow transition
        if (interactiveDuration > 500) {
          console.warn(
            `[ScreenTransition] Slow screen transition: ${screenName} took ${interactiveDuration.toFixed(2)}ms`,
          );

          Telemetry.increment('slow_screen_transitions_total', 1, {
            screen: screenName,
            duration: interactiveDuration.toFixed(2) });
        }
      });
    }
  }, [enabled, screenName, trackMount, trackInteractive]);
}

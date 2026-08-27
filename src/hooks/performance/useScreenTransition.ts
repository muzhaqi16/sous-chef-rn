import { useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';
import { logger } from '#/utils/environment';

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
 * Hook to track screen transition performance.
 *
 * Marks navigation focus and measures focus -> interactive using
 * `react-native-performance`; the central observer in
 * `NativePerformanceService` routes the measure to
 * `screen_interactive_duration_ms`.
 *
 * **Only time-to-interactive is measured, and its floor is one frame.** A
 * `focus -> mounted` measure used to be emitted beside it as
 * `screen_mount_duration_ms`, but the focus mark is written from an effect in
 * the same commit as the mount mark, so it read 0.006-0.028 ms on every screen
 * — it timed effect ordering, not mounting. A component cannot mark the moment
 * before it exists, so the measure was removed rather than renamed. A
 * `screen_transition_duration_ms` was emitted too, from the identical pair of
 * marks as the interactive measure, so it was a second name for one number.
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
    trackInteractive?: boolean;
  },
): void {
  const focusMarkRef = useRef<string | null>(null);
  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
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
      performance.clearMarks(`screen:${screenName}:interactiveEnd`);
      focusMarkRef.current = null;
    };
  });

  // Track time to interactive
  useEffect(() => {
    if (!enabled || !trackInteractive || focusMarkRef.current === null) {
      return;
    }

    // Mark the screen interactive after the next frame
    requestAnimationFrame(() => {
      if (focusMarkRef.current === null) {
        return; // Screen already unmounted
      }

      const interactiveMarkName = `screen:${screenName}:interactiveEnd`;
      performance.mark(interactiveMarkName);

      // Measure focus -> interactive (central observer routes to
      // screen_interactive_duration_ms)
      const interactiveDuration = safeMeasureOrAbort(
        `screen:${screenName}:interactive`,
        focusMarkRef.current,
        interactiveMarkName,
      );
      if (interactiveDuration === null) {
        return;
      }

      // Record metrics in performance store for dashboard (isolated from main store)
      usePerformanceStore
        .getState()
        .recordScreenTransition(screenName, interactiveDuration);

      // Warn if slow transition
      if (interactiveDuration > 500) {
        logger.warn(
          `[ScreenTransition] Slow screen transition: ${screenName} took ${interactiveDuration.toFixed(
            2,
          )}ms`,
        );

        // `duration` is deliberately NOT a label — see useCommitTracking. The
        // magnitude lives in screen_interactive_duration_ms.
        Telemetry.increment('slow_screen_transitions_total', 1, {
          screen: screenName,
        });
      }
    });
  }, [enabled, screenName, trackInteractive]);
}

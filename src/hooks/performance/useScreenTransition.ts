import { useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';
import { logger } from '#/utils/environment';

/** Duration between two marks, or null if they were cleared — abort on null. */
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
 * Marks navigation focus and measures focus → interactive, routed to
 * `screen_interactive_duration_ms`. ONLY time-to-interactive is measurable, floor
 * one frame: a component cannot mark the moment before it exists, so focus →
 * mounted would time effect ordering, not mounting.
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

  useFocusEffect(() => {
    if (!enabled) {
      return;
    }

    const focusMarkName = `screen:${screenName}:focus`;
    performance.mark(focusMarkName);
    focusMarkRef.current = focusMarkName;

    return () => {
      // Cleared on blur, or the marks accumulate.
      performance.clearMarks(`screen:${screenName}:focus`);
      performance.clearMarks(`screen:${screenName}:interactiveEnd`);
      focusMarkRef.current = null;
    };
  });

  useEffect(() => {
    if (!enabled || !trackInteractive || focusMarkRef.current === null) {
      return;
    }

    requestAnimationFrame(() => {
      if (focusMarkRef.current === null) {
        return; // Screen already unmounted.
      }

      const interactiveMarkName = `screen:${screenName}:interactiveEnd`;
      performance.mark(interactiveMarkName);

      const interactiveDuration = safeMeasureOrAbort(
        `screen:${screenName}:interactive`,
        focusMarkRef.current,
        interactiveMarkName,
      );
      if (interactiveDuration === null) {
        return;
      }

      usePerformanceStore
        .getState()
        .recordScreenTransition(screenName, interactiveDuration);

      if (interactiveDuration > 500) {
        logger.warn(
          `[ScreenTransition] Slow screen transition: ${screenName} took ${interactiveDuration.toFixed(
            2,
          )}ms`,
        );

        // `duration` is deliberately NOT a label: a threshold-gated counter
        // cannot carry the magnitude — that lives in the histogram above.
        Telemetry.increment('slow_screen_transitions_total', 1, {
          screen: screenName,
        });
      }
    });
  }, [enabled, screenName, trackInteractive]);
}

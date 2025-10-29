import { useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance';

/**
 * Hook to track screen transition performance
 *
 * Measures navigation time and screen mount/interactive time.
 * Integrates with React Navigation's focus events.
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
  const navigationStartTime = useRef<number | null>(null);
  const mountTime = useRef<number | null>(null);
  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
  const trackMount = options?.trackMount ?? true;
  const trackInteractive = options?.trackInteractive ?? true;

  // Track focus event (navigation to this screen)
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return;
      }

      navigationStartTime.current = performance.now();

      if (__DEV__) {
        console.log(`[ScreenTransition] ${screenName} focused`);
      }

      return () => {
        // Screen is blurring/unfocusing
        navigationStartTime.current = null;
        mountTime.current = null;
      };
    }, [enabled, screenName]),
  );

  // Track mount time
  useEffect(() => {
    if (!enabled || !trackMount || navigationStartTime.current === null) {
      return;
    }

    const mountEndTime = performance.now();
    const mountDuration = mountEndTime - navigationStartTime.current;
    mountTime.current = mountEndTime;

    // Report mount metrics
    Telemetry.histogram('screen_mount_duration_ms', mountDuration, {
      screen: screenName,
    });

    if (__DEV__) {
      console.log(
        `[ScreenTransition] ${screenName} mounted in ${mountDuration.toFixed(2)}ms`,
      );
    }

    // Mark screen as interactive after next frame
    // This gives time for initial render to complete
    if (trackInteractive) {
      requestAnimationFrame(() => {
        if (navigationStartTime.current === null) {
          return; // Screen already unmounted
        }

        const interactiveTime = performance.now();
        const interactiveDuration = interactiveTime - navigationStartTime.current;

        // Report interactive metrics
        Telemetry.histogram('screen_interactive_duration_ms', interactiveDuration, {
          screen: screenName,
        });

        Telemetry.histogram('screen_transition_duration_ms', interactiveDuration, {
          screen: screenName,
        });

        if (__DEV__) {
          console.log(
            `[ScreenTransition] ${screenName} interactive in ${interactiveDuration.toFixed(2)}ms`,
          );
        }

        // Warn if slow transition
        if (interactiveDuration > 500) {
          console.warn(
            `[ScreenTransition] Slow screen transition: ${screenName} took ${interactiveDuration.toFixed(2)}ms`,
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

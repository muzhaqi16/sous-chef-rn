import { useFocusEffect } from '@react-navigation/native';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { useOptimisticDataRestorationMultiple } from '#/hooks/offline/useOptimisticDataRestoration';
import { useScreenTransition } from '#/hooks/performance/useScreenTransition';
import { useScreenTelemetry } from '#/hooks/performance/useScreenTelemetry';

/**
 * Resumes Apollo cache persistence on focus and pauses it on blur, so heavy
 * serialization cannot fire during the next screen's scroll. At module scope so
 * the reference is stable without memoization.
 */
const onScreenFocus = () => {
  apolloCachePersistence.resume();
  return () => {
    apolloCachePersistence.pause();
  };
};

interface UseTabScreenLifecycleOptions {
  screenName: string;
  optimisticTypes: string[];
  telemetryProperties: () => Record<string, unknown>;
}

/** The four lifecycle hooks every tab screen calls identically. */
export function useTabScreenLifecycle({
  screenName,
  optimisticTypes,
  telemetryProperties,
}: UseTabScreenLifecycleOptions): void {
  useOptimisticDataRestorationMultiple(optimisticTypes);
  useFocusEffect(onScreenFocus);
  useScreenTransition(screenName);
  useScreenTelemetry(screenName, telemetryProperties);
}

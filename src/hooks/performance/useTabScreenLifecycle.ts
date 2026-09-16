import { useOptimisticDataRestorationMultiple } from '#/hooks/offline/useOptimisticDataRestoration';
import type { PersistedEntityType } from '#/apollo/offline/OptimisticDataPersistence';
import { useScreenTransition } from '#/hooks/performance/useScreenTransition';
import { useScreenTelemetry } from '#/hooks/performance/useScreenTelemetry';

interface UseTabScreenLifecycleOptions {
  screenName: string;
  optimisticTypes: PersistedEntityType[];
  telemetryProperties: () => Record<string, unknown>;
}

/** The lifecycle hooks every tab screen calls identically. */
export function useTabScreenLifecycle({
  screenName,
  optimisticTypes,
  telemetryProperties,
}: UseTabScreenLifecycleOptions): void {
  useOptimisticDataRestorationMultiple(optimisticTypes);
  useScreenTransition(screenName);
  useScreenTelemetry(screenName, telemetryProperties);
}

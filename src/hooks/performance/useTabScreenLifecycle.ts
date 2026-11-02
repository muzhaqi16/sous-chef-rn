import { useScreenTransition } from '#/hooks/performance/useScreenTransition';
import { useScreenTelemetry } from '#/hooks/performance/useScreenTelemetry';

interface UseTabScreenLifecycleOptions {
  screenName: string;
  telemetryProperties: () => Record<string, unknown>;
}

/** The lifecycle hooks every tab screen calls identically. */
export function useTabScreenLifecycle({
  screenName,
  telemetryProperties,
}: UseTabScreenLifecycleOptions): void {
  useScreenTransition(screenName);
  useScreenTelemetry(screenName, telemetryProperties);
}

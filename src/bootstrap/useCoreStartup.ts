import { useEffect, useRef } from 'react';
import { registerQueueFailureHandler } from '#/apollo/offlineQueue/queueFailureHandler';
import { ensureDeviceId } from '#/services/auth/deviceId';
import { Telemetry } from '#services/telemetry';
import { useAppStore, useIsHydrated } from '#store/useAppStore';
import { scheduleIdle } from '#/utils/scheduleIdle';
import { guardedStartupHost, type StartupHost } from './startupHost';

/** One-shot guard for `app_startup_duration_ms` across Fast Refresh remounts. */
let reportedStartupDuration = false;

// Left in place after reading: `store/index.ts` and the fully-drawn mark read
// the same origin later.
const reportStartupDuration = (): void => {
  const startedAt = (globalThis as { __APP_START_TIMESTAMP?: number })
    .__APP_START_TIMESTAMP;
  if (!startedAt || reportedStartupDuration) return;
  reportedStartupDuration = true;
  Telemetry.histogram('app_startup_duration_ms', Date.now() - startedAt, {
    type: 'js_to_hydrated',
  });
};

/**
 * The core's start-up, once storage has hydrated: the host's `beforeStart`,
 * then the device identity, offline-queue failure handling and telemetry,
 * then the host's `afterStart`. Ref-guarded, so a re-run of the effect does
 * not start anything twice; its cleanup stops what the host started.
 */
export function useCoreStartup(host: StartupHost): void {
  const isHydrated = useIsHydrated();
  const getTelemetryConfig = useAppStore(state => state.getTelemetryConfig);
  const startedRef = useRef(false);

  useEffect(() => {
    const steps = guardedStartupHost(host);
    if (isHydrated && !startedRef.current) {
      startedRef.current = true;
      const options = steps.beforeStart();

      void ensureDeviceId();
      registerQueueFailureHandler();

      const telemetryConfig = getTelemetryConfig();
      if (options?.telemetry === false) {
        telemetryConfig.enableLogs = false;
        telemetryConfig.enableMetrics = false;
      }
      Telemetry.updateConfig(telemetryConfig);
      Telemetry.initialize();
      scheduleIdle(() => Telemetry.increment('app_starts_total'));
      reportStartupDuration();
      Telemetry.trackEvent('app_launched', {
        ...steps.launchProperties(),
        timestamp: new Date().toISOString(),
      });

      steps.afterStart();
    }
    return () => steps.stop();
  }, [isHydrated, getTelemetryConfig, host]);
}

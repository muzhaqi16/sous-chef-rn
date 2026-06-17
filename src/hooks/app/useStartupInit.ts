import React, { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { LaunchArguments } from 'react-native-launch-arguments';
import { logger } from '#/utils/environment';
import { useAppStore, useIsHydrated } from '#store/useAppStore';
import { useStore } from '#store';
import { Telemetry } from '#services/telemetry';
import { HapticService } from '#services/haptic/HapticService';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { hasCredentials, getLastBiometricEmail } from '#storage/keychain';
import { initializeDeviceId } from '#/utils/deviceId';

/**
 * DEV-only: read launch arguments injected by Detox to bypass the login UI
 * during E2E runs. Module-level so try-catch is safe (React Compiler doesn't
 * apply outside hook bodies).
 */
function injectDetoxLaunchArgs(
  detoxBackgroundServicesDisabledRef: React.RefObject<boolean>,
): void {
  try {
    const args = LaunchArguments.value<{
      detoxServer?: string;
      detoxUserToken?: string;
      detoxRefreshToken?: string;
      detoxUser?: string;
      detoxDisableBackgroundServices?: string;
    }>();
    // Under Detox the LogBox dev-warning toast overlays the floating tab bar and
    // breaks screenshot/visibility checks — silence it for E2E runs only.
    if (args.detoxServer) {
      LogBox.ignoreAllLogs();
    }
    if (args.detoxUserToken && args.detoxRefreshToken && args.detoxUser) {
      const user = JSON.parse(args.detoxUser);
      useStore
        .getState()
        .setAuth(user, args.detoxUserToken, args.detoxRefreshToken);
      logger.debug('[Detox] Auth injected via launchArgs');
    }
    if (args.detoxDisableBackgroundServices) {
      detoxBackgroundServicesDisabledRef.current = true;
      logger.debug('[Detox] Background services disabled for E2E tests');
    }
  } catch {
    // No launch args or parse error — normal app startup
  }
}

/**
 * One-time bootstrap that runs after Zustand hydration completes:
 *   device ID → stored credentials → offline mode flag → telemetry →
 *   idle-deferred haptics + native performance + memory monitor →
 *   startup duration histograms → app_launched event.
 *
 * Guarded by an internal ref so the heavy services don't restart when the
 * effect re-runs (e.g., theme changes that touch UnistylesRuntime).
 */
export function useStartupInit(): void {
  const isHydrated = useIsHydrated();
  const setHasStoredCredentials = useAppStore(
    state => state.setHasStoredCredentials,
  );
  const getTelemetryConfig = useAppStore(state => state.getTelemetryConfig);

  const hydrationInitializedRef = useRef(false);
  const detoxBackgroundServicesDisabledRef = useRef(false);

  useEffect(() => {
    if (isHydrated && !hydrationInitializedRef.current) {
      hydrationInitializedRef.current = true;

      if (__DEV__) {
        injectDetoxLaunchArgs(detoxBackgroundServicesDisabledRef);
      }

      // Capture AFTER Detox injection has had a chance to mutate the ref,
      // so the value reflects whatever Detox actually requested.
      const detoxDisabled = detoxBackgroundServicesDisabledRef.current;

      // Initialize device ID early — needed for WebSocket subscription self-echo filtering
      initializeDeviceId();

      // Credentials are scoped per account; the most-recently-enrolled account
      // is the one the login screen offers, so report on that account.
      getLastBiometricEmail().then(email => {
        if (!email) {
          setHasStoredCredentials(false);
          return;
        }
        hasCredentials(email).then(setHasStoredCredentials);
      });

      // offlineModeEnabled is hydrated from MMKV in the persist
      // onRehydrateStorage callback (see src/store/index.ts), which runs
      // before `isHydrated` flips — so by the time this effect fires the
      // value is already correct.

      const telemetryConfig = getTelemetryConfig();
      if (detoxDisabled) {
        telemetryConfig.enableLogs = false;
        telemetryConfig.enableMetrics = false;
      }
      Telemetry.updateConfig(telemetryConfig);
      Telemetry.initialize();

      // Defer non-first-paint work to the idle queue. Haptics caches user
      // preferences but isn't needed until the first tap; native perf and
      // memory monitor are observation-only and benefit from running off
      // the navigation-mount critical path.
      requestIdleCallback(() => {
        HapticService.initialize();
        if (!detoxDisabled) {
          NativePerformanceService.initialize();
          if (!__DEV__) {
            MemoryMonitor.start();
          }
        }
      });

      if (global.__APP_START_TIMESTAMP) {
        const startupDuration = Date.now() - global.__APP_START_TIMESTAMP;
        Telemetry.histogram('app_startup_duration_ms', startupDuration, {
          type: 'js_to_hydrated',
        });

        global.__APP_START_TIMESTAMP = undefined; // Prevent re-reporting on HMR
      }

      Telemetry.trackEvent('app_launched', {
        theme: UnistylesRuntime.themeName,
        timestamp: new Date().toISOString(),
      });
    }

    // Snapshot the ref AFTER the if-block above has run (and any Detox
    // injection inside it has mutated the ref). This local — not a direct
    // ref read inside cleanup — keeps react-hooks/exhaustive-deps happy
    // and reflects the post-injection value.
    const detoxDisabledAtCleanup = detoxBackgroundServicesDisabledRef.current;
    return () => {
      if (!detoxDisabledAtCleanup) {
        NativePerformanceService.cleanup();
        MemoryMonitor.stop();
      }
    };
  }, [isHydrated, setHasStoredCredentials, getTelemetryConfig]);
}

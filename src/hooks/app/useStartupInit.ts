import React, { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { LaunchArguments } from 'react-native-launch-arguments';
import { logger, Environment } from '#/utils/environment';
import { useAppStore, useIsHydrated } from '#store/useAppStore';
import { useStore } from '#store';
import {
  PantrySortDirection,
  PantrySortOption,
} from '#store/slices/preferenceTypes';
import { suppressFeatureHintsForE2E } from '#/hooks/useFeatureHint';
import { Telemetry } from '#services/telemetry';
import { HapticService } from '#services/haptic/HapticService';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import {
  hasCredentials,
  getLastBiometricEmail,
  clearTempRegistrationPassword,
} from '#storage/keychain';
import { initializeDeviceId } from '#/storage/deviceId';
import { authService } from '#services/authService';
import { registerQueueFailureHandler } from '#/apollo/offlineQueue/queueFailureHandler';

/**
 * Reads Detox-injected launch arguments to bypass the login UI in E2E runs.
 * Module-level so the try/catch is safe — the React Compiler does not reach
 * outside hook bodies.
 */
function injectDetoxLaunchArgs(
  detoxBackgroundServicesDisabledRef: React.RefObject<boolean>,
  detoxTelemetryEnabledRef: React.RefObject<boolean>,
): void {
  try {
    // react-native-launch-arguments JSON.parses any value it can, so the
    // detoxUser payload arrives as an object (a plain string on older lib
    // versions) — handle both.
    const args = LaunchArguments.value<{
      detoxServer?: string;
      detoxUserToken?: string;
      detoxRefreshToken?: string;
      detoxUser?: string | Record<string, unknown>;
      detoxDisableBackgroundServices?: string;
      detoxEnableTelemetry?: string;
      detoxPantrySortOption?: string;
      detoxPantrySortDirection?: string;
    }>();
    // LogBox overlays the floating tab bar and breaks visibility checks; the
    // feature-hint tutorial dims the screen and swallows taps on a 2s delay.
    if (args.detoxServer) {
      LogBox.ignoreAllLogs();
      suppressFeatureHintsForE2E();
    }
    if (args.detoxUserToken && args.detoxRefreshToken && args.detoxUser) {
      const user =
        typeof args.detoxUser === 'string'
          ? JSON.parse(args.detoxUser)
          : args.detoxUser;
      const store = useStore.getState();
      store.setAuth(user, args.detoxUserToken, args.detoxRefreshToken);
      // The root navigator gates on navigationState, which the real login flow
      // sets separately from setAuth — without this the auth group renders.
      store.setNavigationState('main_app');
      logger.debug('[Detox] Auth injected via launchArgs');
    }
    // Seeded rather than driven through the sort modal, which renders under
    // `{!!stats && …}` and so only exists once the stats query resolves.
    if (args.detoxPantrySortOption) {
      const store = useStore.getState();
      store.setPantrySortOption(args.detoxPantrySortOption as PantrySortOption);
      if (args.detoxPantrySortDirection) {
        store.setPantrySortDirection(
          args.detoxPantrySortDirection as PantrySortDirection,
        );
      }
      logger.debug('[Detox] Pantry sort injected via launchArgs');
    }
    if (args.detoxDisableBackgroundServices) {
      detoxBackgroundServicesDisabledRef.current = true;
      logger.debug('[Detox] Background services disabled for E2E tests');
    }
    // Separate from the flag above: that one stops timers blocking Detox's idle
    // detection, while this keeps the e2e suite — the repo's only deterministic
    // workload — able to produce a measurement. A measuring run passes both.
    if (args.detoxEnableTelemetry) {
      detoxTelemetryEnabledRef.current = true;
      logger.debug('[Detox] Telemetry kept ON for this E2E run');
    }
  } catch (error) {
    // Loud on purpose, or E2E auth silently degrades to the slow UI login.
    logger.warn('[Detox] Launch-arg injection failed:', error);
  }
}

/** One-shot guard for `app_startup_duration_ms` across Fast Refresh remounts. */
let reportedStartupDuration = false;

/**
 * One-time bootstrap after Zustand hydration. Ref-guarded so the heavy services
 * do not restart when the effect re-runs (a theme change touching
 * `UnistylesRuntime`, for one).
 */
export function useStartupInit(): void {
  const isHydrated = useIsHydrated();
  const setHasStoredCredentials = useAppStore(
    state => state.setHasStoredCredentials,
  );
  const getTelemetryConfig = useAppStore(state => state.getTelemetryConfig);

  const hydrationInitializedRef = useRef(false);
  const detoxBackgroundServicesDisabledRef = useRef(false);
  const detoxTelemetryEnabledRef = useRef(false);

  useEffect(() => {
    if (isHydrated && !hydrationInitializedRef.current) {
      hydrationInitializedRef.current = true;

      // A NAMED capability, default off — never an environment test. `.env`
      // carries `NODE_ENV=development` and every local release variant falls
      // through to it, so `isDevelopment()` would let a Release-configuration
      // binary honour injected sessions.
      if (Environment.allowsLaunchArgAuth()) {
        injectDetoxLaunchArgs(
          detoxBackgroundServicesDisabledRef,
          detoxTelemetryEnabledRef,
        );
      }

      // AFTER injection, so the value reflects what Detox requested.
      const detoxDisabled = detoxBackgroundServicesDisabledRef.current;

      // Early — WebSocket self-echo filtering needs it.
      initializeDeviceId();

      // Withdraws local-first cache writes the server refuses. Must be in place
      // before any queue drain can run.
      registerQueueFailureHandler();

      // Credentials are per account, and the login screen offers the
      // most-recently-enrolled one.
      getLastBiometricEmail().then(email => {
        if (!email) {
          setHasStoredCredentials(false);
          return;
        }
        hasCredentials(email).then(setHasStoredCredentials);
      });

      // An earlier build kept the registration password in the keychain, where
      // it outlives even an app deletion. Nothing writes it now; this purges it.
      clearTempRegistrationPassword();

      const telemetryConfig = getTelemetryConfig();
      // A run that asked for telemetry keeps it even with background services
      // off — see injectDetoxLaunchArgs.
      if (detoxDisabled && !detoxTelemetryEnabledRef.current) {
        telemetryConfig.enableLogs = false;
        telemetryConfig.enableMetrics = false;
      }
      Telemetry.updateConfig(telemetryConfig);
      Telemetry.initialize();

      // Off the navigation-mount critical path: haptics isn't needed until the
      // first tap, and the perf/memory services are observation-only.
      requestIdleCallback(() => {
        // Deferred, not emitted from `Telemetry.initialize()`: its `device_type`
        // label resolves `isEmulatorSync()`, a binder IPC on Android hardware,
        // which would charge the very startup window it labels.
        Telemetry.increment('app_starts_total');

        HapticService.initialize();
        if (!detoxDisabled || detoxTelemetryEnabledRef.current) {
          // Startup marks come from here — without it a measuring run reports no
          // `app_native_launch_ms` / `app_js_bundle_load_ms`. Installs no timer.
          NativePerformanceService.initialize();
        }

        // On `detoxDisabled` ALONE, unlike the block above: this installs a 10 s
        // snapshot interval, the one repeating timer NOT needed for a
        // measurement and exactly what blocks Detox's idle detection.
        if (!detoxDisabled && !__DEV__) {
          MemoryMonitor.start();
        }
      });

      // A keychain-restored session skips the login path where device
      // registration happens, so the push-token rotation listener would never
      // subscribe. `registerDeviceOnce` permission-gates, so this never prompts.
      const { user, accessToken } = useStore.getState();
      if (user && accessToken && !detoxDisabled) {
        requestIdleCallback(() => authService.registerDeviceInBackground());
      }

      // A module-scope latch, NEVER `global.__APP_START_TIMESTAMP = undefined`:
      // that global is the shared JS-entry origin, still read by
      // `markFullyDrawn()` long after this runs.
      if (global.__APP_START_TIMESTAMP && !reportedStartupDuration) {
        reportedStartupDuration = true;
        const startupDuration = Date.now() - global.__APP_START_TIMESTAMP;
        Telemetry.histogram('app_startup_duration_ms', startupDuration, {
          type: 'js_to_hydrated',
        });
      }

      Telemetry.trackEvent('app_launched', {
        theme: UnistylesRuntime.themeName,
        timestamp: new Date().toISOString(),
      });
    }

    // Snapshot AFTER injection has mutated the ref; a local rather than a ref
    // read inside cleanup keeps `react-hooks/exhaustive-deps` satisfied.
    const detoxDisabledAtCleanup = detoxBackgroundServicesDisabledRef.current;
    const detoxTelemetryEnabledAtCleanup = detoxTelemetryEnabledRef.current;
    return () => {
      // Mirrors the init guard — a measuring run initializes both.
      if (!detoxDisabledAtCleanup || detoxTelemetryEnabledAtCleanup) {
        NativePerformanceService.cleanup();
        MemoryMonitor.stop();
      }
    };
  }, [isHydrated, setHasStoredCredentials, getTelemetryConfig]);
}

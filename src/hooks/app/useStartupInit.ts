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
import { hasCredentials, getLastBiometricEmail } from '#storage/keychain';
import { initializeDeviceId } from '#/utils/deviceId';
import { authService } from '#services/authService';
import { registerQueueFailureHandler } from '#/apollo/offlineQueue/queueFailureHandler';

/**
 * DEV-only: read launch arguments injected by Detox to bypass the login UI
 * during E2E runs. Module-level so try-catch is safe (React Compiler doesn't
 * apply outside hook bodies).
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
    // Under Detox the LogBox dev-warning toast overlays the floating tab bar and
    // breaks screenshot/visibility checks — silence it for E2E runs only.
    if (args.detoxServer) {
      LogBox.ignoreAllLogs();
      // The feature-hint tutorial dims the screen and swallows taps, on a 2s
      // delay that lands after any post-login dismissal helper has run.
      suppressFeatureHintsForE2E();
    }
    if (args.detoxUserToken && args.detoxRefreshToken && args.detoxUser) {
      const user =
        typeof args.detoxUser === 'string'
          ? JSON.parse(args.detoxUser)
          : args.detoxUser;
      const store = useStore.getState();
      store.setAuth(user, args.detoxUserToken, args.detoxRefreshToken);
      // The root navigator gates its groups on navigationState, which the
      // real login flow sets separately from setAuth (handleLogin) — without
      // this the injected session renders the auth group anyway.
      store.setNavigationState('main_app');
      logger.debug('[Detox] Auth injected via launchArgs');
    }
    // Seed the pantry sort so a test does not have to drive the sort modal to
    // reach a known order. That control renders under `{!!stats && …}`, so it
    // only exists once the stats query resolves — driving it means waiting on
    // the network for a value the test already knows. Seeding it here means the
    // list is in the requested order from the first frame.
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
    // Opt-in, and separate from the flag above, because the two answer
    // different questions. `detoxDisableBackgroundServices` exists to stop
    // timers that block Detox's idle detection; it was ALSO switching telemetry
    // off, which made the e2e suite — the only deterministic workload in the
    // repo — incapable of producing a measurement. A run that wants numbers
    // passes both. Opt-in rather than on-by-default so existing suites are
    // unaffected.
    if (args.detoxEnableTelemetry) {
      detoxTelemetryEnabledRef.current = true;
      logger.debug('[Detox] Telemetry kept ON for this E2E run');
    }
  } catch (error) {
    // A real injection failure must be loud (dev log level always shows
    // warn), or E2E auth silently degrades to the slow UI-login fallback.
    logger.warn('[Detox] Launch-arg injection failed:', error);
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
/** One-shot guard for `app_startup_duration_ms` across Fast Refresh remounts. */
let reportedStartupDuration = false;

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

      // An ALLOWLIST, not `!isProduction()`. This gate decides whether the app
      // will accept an auth state handed to it through `am start --es`, so it
      // must fail closed: a variant gets that capability only by being named
      // here, never by omitting a `NODE_ENV=production` somewhere. Under
      // `!isProduction()` a future `.env.qa` would silently acquire it.
      //
      // Not `__DEV__` either — that excluded every release variant, so a Detox
      // run against `localRelease`/`release` read NO launch args at all, and
      // release is the only variant whose performance numbers are valid. Every
      // config the suite uses falls through to `.env` (`NODE_ENV=development`),
      // and `isDevelopment` also covers any debug bundle via `__DEV__`, so this
      // costs the suite nothing while excluding staging builds given to testers.
      if (Environment.isDevelopment()) {
        injectDetoxLaunchArgs(
          detoxBackgroundServicesDisabledRef,
          detoxTelemetryEnabledRef,
        );
      }

      // Capture AFTER Detox injection has had a chance to mutate the ref,
      // so the value reflects whatever Detox actually requested.
      const detoxDisabled = detoxBackgroundServicesDisabledRef.current;

      // Initialize device ID early — needed for WebSocket subscription self-echo filtering
      initializeDeviceId();

      // Local-first writes land in the cache before the server sees them, so
      // something has to withdraw them when the server refuses. Registered
      // before any queue drain can run.
      registerQueueFailureHandler();

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
      // A run that asked for telemetry keeps it, even with background services
      // off — those flags answer different questions (see injectDetoxLaunchArgs).
      if (detoxDisabled && !detoxTelemetryEnabledRef.current) {
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
        if (!detoxDisabled || detoxTelemetryEnabledRef.current) {
          // Startup marks come from here; without it a measuring run reports
          // no `app_native_launch_ms` / `app_js_bundle_load_ms`.
          NativePerformanceService.initialize();
          if (!__DEV__) {
            MemoryMonitor.start();
          }
        }
      });

      // A keychain-restored session skips the login path, which is where
      // device registration normally happens — without this, the push-token
      // rotation listener is never subscribed and an OS token rotation
      // silently kills push until the next manual login. registerDeviceOnce
      // permission-gates token acquisition, so this never prompts.
      const { user, accessToken } = useStore.getState();
      if (user && accessToken && !detoxDisabled) {
        requestIdleCallback(() => authService.registerDeviceInBackground());
      }

      // A module-scope latch, NOT `global.__APP_START_TIMESTAMP = undefined`.
      // That global is the shared JS-entry origin — `store/index.ts` and
      // `NativePerformanceService.markFullyDrawn()` both measure from it, and
      // the latter runs when the first list finishes loading, long after this.
      // Clearing it here to get an HMR guard silently zeroed those consumers.
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

    // Snapshot the ref AFTER the if-block above has run (and any Detox
    // injection inside it has mutated the ref). This local — not a direct
    // ref read inside cleanup — keeps react-hooks/exhaustive-deps happy
    // and reflects the post-injection value.
    const detoxDisabledAtCleanup = detoxBackgroundServicesDisabledRef.current;
    const detoxTelemetryEnabledAtCleanup = detoxTelemetryEnabledRef.current;
    return () => {
      // Mirrors the init guard above — a measuring run initializes both, so it
      // has to tear both down.
      if (!detoxDisabledAtCleanup || detoxTelemetryEnabledAtCleanup) {
        NativePerformanceService.cleanup();
        MemoryMonitor.stop();
      }
    };
  }, [isHydrated, setHasStoredCredentials, getTelemetryConfig]);
}

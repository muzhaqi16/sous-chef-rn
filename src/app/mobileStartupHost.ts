import { useState } from 'react';
import { LogBox } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { LaunchArguments } from 'react-native-launch-arguments';
import { logger, Environment } from '#/utils/environment';
import { useAppStore } from '#store/useAppStore';
import { useStore } from '#store';
import type {
  PantrySortDirection,
  PantrySortOption,
} from '#store/slices/preferenceTypes';
import { suppressFeatureHintsForE2E } from '#/hooks/settings/useFeatureHint';
import { HapticService } from '#services/haptic/HapticService';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import {
  hasCredentials,
  getLastBiometricEmail,
} from '#native/storage/keychain';
import { registerDeviceInBackground } from '#/services/device/deviceRegistration';
import type { AuthUserInput } from '#store/slices/authSlice';
import type { StartupHost } from '#bootstrap/startupHost';

/** What an end-to-end run's launch arguments asked of this start. */
interface EndToEndFlags {
  backgroundServicesDisabled: boolean;
  telemetryEnabled: boolean;
}

/** The launch argument is harness-supplied JSON; only a user-shaped value is injected. */
function isInjectedUser(value: unknown): value is AuthUserInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string'
  );
}

/**
 * Reads Detox-injected launch arguments to bypass the login UI in E2E runs.
 * Module-level so the try/catch is safe — the React Compiler does not reach
 * outside hook bodies.
 */
function injectDetoxLaunchArgs(flags: EndToEndFlags): void {
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
      const user: unknown =
        typeof args.detoxUser === 'string'
          ? JSON.parse(args.detoxUser)
          : args.detoxUser;
      if (isInjectedUser(user)) {
        const store = useStore.getState();
        store.setAuth(user, args.detoxUserToken, args.detoxRefreshToken);
        // The root navigator gates on navigationState, which the real login
        // flow sets separately from setAuth — without this the auth group renders.
        store.setNavigationState('main_app');
        logger.debug('[Detox] Auth injected via launchArgs');
      } else {
        logger.warn(
          '[Detox] detoxUser launch argument is not a user; not injected',
        );
      }
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
      flags.backgroundServicesDisabled = true;
      logger.debug('[Detox] Background services disabled for E2E tests');
    }
    // Separate from the flag above: that one stops timers blocking Detox's idle
    // detection, while this keeps the e2e suite — the repo's only deterministic
    // workload — able to produce a measurement. A measuring run passes both.
    if (args.detoxEnableTelemetry) {
      flags.telemetryEnabled = true;
      logger.debug('[Detox] Telemetry kept ON for this E2E run');
    }
  } catch (error) {
    // Loud on purpose, or E2E auth silently degrades to the slow UI login.
    logger.warn('[Detox] Launch-arg injection failed:', error);
  }
}

/**
 * What start-up does on this device beyond the core: an end-to-end run's
 * launch arguments first, then the stored biometric sign-in, haptics, native performance marks, the memory
 * monitor and push registration. One per root mount, which holds the flags an
 * end-to-end run set for `stop` to read.
 */
export function createMobileStartupHost(
  setHasStoredCredentials: (stored: boolean) => void,
): StartupHost {
  const flags: EndToEndFlags = {
    backgroundServicesDisabled: false,
    telemetryEnabled: false,
  };
  // Only a run that disabled background services without asking to keep
  // telemetry goes unmeasured.
  const measures = () =>
    !flags.backgroundServicesDisabled || flags.telemetryEnabled;

  return {
    beforeStart: () => {
      if (Environment.allowsLaunchArgAuth()) injectDetoxLaunchArgs(flags);
      return { telemetry: measures() };
    },
    afterStart: () => {
      void getLastBiometricEmail().then(email => {
        if (!email) {
          setHasStoredCredentials(false);
          return;
        }
        void hasCredentials(email).then(setHasStoredCredentials);
      });

      requestIdleCallback(() => {
        HapticService.initialize();
        if (measures()) NativePerformanceService.initialize();
        // The monitor's 10 s interval is the app's only repeating timer, which
        // blocks Detox's idle detection even on a measuring run.
        if (!flags.backgroundServicesDisabled && !__DEV__) {
          MemoryMonitor.start();
        }
      });

      const { user, accessToken } = useStore.getState();
      if (user && accessToken && !flags.backgroundServicesDisabled) {
        requestIdleCallback(() => registerDeviceInBackground());
      }
    },
    launchProperties: () => ({ theme: UnistylesRuntime.themeName }),
    stop: () => {
      if (measures()) {
        NativePerformanceService.cleanup();
        MemoryMonitor.stop();
      }
    },
  };
}

/** The mobile start-up host, created once for the root's lifetime. */
export function useMobileStartupHost(): StartupHost {
  const setHasStoredCredentials = useAppStore(
    state => state.setHasStoredCredentials,
  );
  const [host] = useState(() =>
    createMobileStartupHost(setHasStoredCredentials),
  );
  return host;
}

import { StateCreator } from 'zustand';
import type { RootState } from '../index';
import { TelemetryConfig } from '#/services/telemetry/types';
import { Environment } from '#/utils/environment';

export interface TelemetryState {
  isEnabled: boolean;
  enableMetrics: boolean;
  enableLogs: boolean;
  enableConsoleInDev: boolean;
  userConsent: boolean | null;

  setTelemetryEnabled: (enabled: boolean) => void;
  setMetricsEnabled: (enabled: boolean) => void;
  setLogsEnabled: (enabled: boolean) => void;
  setConsoleInDevEnabled: (enabled: boolean) => void;
  setUserConsent: (consent: boolean) => void;
  getTelemetryConfig: () => Partial<TelemetryConfig>;
  resetTelemetry: () => void;
}

// isEnabled / enableMetrics / enableLogs / enableConsoleInDev are derived
// from the build environment on every launch and are intentionally NOT
// persisted (see partialize in store/index.ts). Only `userConsent` is a real
// user choice worth persisting. Persisting the derived flags once baked a
// stale `enableLogs: false` into every device's MMKV blob, which silently
// killed log shipping even after the in-code default changed.
export const initialTelemetryState = {
  isEnabled: Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
  enableMetrics:
    Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
  enableLogs:
    Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
  enableConsoleInDev: false,
  userConsent: null,
};

export const createTelemetrySlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  TelemetryState
> = (set, get) => ({
  ...initialTelemetryState,

  setTelemetryEnabled: (enabled: boolean) =>
    set(state => {
      state.isEnabled = enabled;
      if (enabled) {
        // Re-derive instead of leaving whatever a previous disable zeroed —
        // otherwise a disable→enable round-trip leaves metrics/logs dead.
        state.enableMetrics = initialTelemetryState.enableMetrics;
        state.enableLogs = initialTelemetryState.enableLogs;
      } else {
        state.enableMetrics = false;
        state.enableLogs = false;
      }
    }),

  setMetricsEnabled: (enabled: boolean) =>
    set(state => {
      state.enableMetrics = enabled;
    }),

  setLogsEnabled: (enabled: boolean) =>
    set(state => {
      state.enableLogs = enabled;
    }),

  setConsoleInDevEnabled: (enabled: boolean) =>
    set(state => {
      state.enableConsoleInDev = enabled;
    }),

  setUserConsent: (consent: boolean) =>
    set(state => {
      state.userConsent = consent;
      if (consent) {
        // Restore the env-derived defaults: denying consent zeroes the flags
        // below, so re-consenting must re-derive them or telemetry stays
        // permanently dead after one off→on round-trip in settings.
        state.isEnabled = initialTelemetryState.isEnabled;
        state.enableMetrics = initialTelemetryState.enableMetrics;
        state.enableLogs = initialTelemetryState.enableLogs;
      } else {
        state.isEnabled = false;
        state.enableMetrics = false;
        state.enableLogs = false;
      }
    }),

  getTelemetryConfig: (): Partial<TelemetryConfig> => {
    const state = get();
    return {
      enabled: state.isEnabled && state.userConsent !== false,
      enableMetrics:
        state.enableMetrics && state.isEnabled && state.userConsent !== false,
      enableLogs:
        state.enableLogs && state.isEnabled && state.userConsent !== false,
      enableConsoleInDev: state.enableConsoleInDev,
    };
  },

  resetTelemetry: () => set(initialTelemetryState),
});

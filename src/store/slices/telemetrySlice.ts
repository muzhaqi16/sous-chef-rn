import type { StateCreator } from 'zustand';
import type { RootState } from '../index';
import type { TelemetryConfig } from '#/services/telemetry/types';
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
  applyTelemetryDefaults: () => void;
  getTelemetryConfig: () => Partial<TelemetryConfig>;
  resetTelemetry: () => void;
}

// isEnabled / enableMetrics / enableLogs are derived from the build
// environment on every launch and are intentionally NOT persisted (see
// partialize in store/index.ts). Only `userConsent` is a real user choice worth
// persisting. Persisting the derived flags once baked a stale
// `enableLogs: false` into every device's MMKV blob, which silently killed log
// shipping even after the in-code default changed.
export const telemetryDefaults = () => {
  const enabled =
    Environment.shouldEnableAnalytics() || Environment.isDevelopment();
  return { isEnabled: enabled, enableMetrics: enabled, enableLogs: enabled };
};

// The flags are off until hydration applies `telemetryDefaults()`: the build
// environment is a platform service, and creating the store reads none.
// Telemetry holds what it records until then, since consent is unknown.
const initialTelemetryState = {
  isEnabled: false,
  enableMetrics: false,
  enableLogs: false,
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
        const defaults = telemetryDefaults();
        state.enableMetrics = defaults.enableMetrics;
        state.enableLogs = defaults.enableLogs;
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
        Object.assign(state, telemetryDefaults());
      } else {
        state.isEnabled = false;
        state.enableMetrics = false;
        state.enableLogs = false;
      }
    }),

  applyTelemetryDefaults: () => set(telemetryDefaults()),

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

  resetTelemetry: () =>
    set({ ...initialTelemetryState, ...telemetryDefaults() }),
});

import { StateCreator } from 'zustand';
import { RootState } from '../index';
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
  reset: () => void;
}

export const initialTelemetryState = {
  isEnabled: Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
  enableMetrics: Environment.shouldEnableAnalytics() || Environment.isDevelopment(),
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
      if (!enabled) {
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
      if (!consent) {
        state.isEnabled = false;
        state.enableMetrics = false;
        state.enableLogs = false;
      }
    }),

  getTelemetryConfig: (): Partial<TelemetryConfig> => {
    const state = get();
    return {
      enabled: state.isEnabled && (state.userConsent !== false),
      enableMetrics: state.enableMetrics && state.isEnabled && (state.userConsent !== false),
      enableLogs: state.enableLogs && state.isEnabled && (state.userConsent !== false),
      enableConsoleInDev: state.enableConsoleInDev,
    };
  },

  reset: () => set(initialTelemetryState),
});
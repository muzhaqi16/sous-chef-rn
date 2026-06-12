import { createTestStore } from '#/test-utils/createTestStore';
import { initialTelemetryState } from '../telemetrySlice';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

describe('telemetrySlice', () => {
  it('has initial state', () => {
    const store = createTestStore();
    const state = store.getState();
    expect(typeof state.isEnabled).toBe('boolean');
    expect(typeof state.enableMetrics).toBe('boolean');
    // Derived from the build environment exactly like enableMetrics — a
    // hardcoded false here is the bug that silently disabled log shipping.
    expect(state.enableLogs).toBe(state.enableMetrics);
    expect(state.enableConsoleInDev).toBe(false);
    expect(state.userConsent).toBeNull();
  });

  describe('setTelemetryEnabled', () => {
    it('enables telemetry and restores env-derived metric/log flags', () => {
      const store = createTestStore({
        isEnabled: false,
        enableMetrics: false,
        enableLogs: false,
      });
      store.getState().setTelemetryEnabled(true);
      expect(store.getState().isEnabled).toBe(true);
      expect(store.getState().enableMetrics).toBe(
        initialTelemetryState.enableMetrics,
      );
      expect(store.getState().enableLogs).toBe(
        initialTelemetryState.enableLogs,
      );
    });

    it('disables telemetry and turns off metrics and logs', () => {
      const store = createTestStore({
        isEnabled: true,
        enableMetrics: true,
        enableLogs: true,
      });
      store.getState().setTelemetryEnabled(false);
      expect(store.getState().isEnabled).toBe(false);
      expect(store.getState().enableMetrics).toBe(false);
      expect(store.getState().enableLogs).toBe(false);
    });
  });

  describe('setMetricsEnabled', () => {
    it('enables metrics', () => {
      const store = createTestStore({ enableMetrics: false });
      store.getState().setMetricsEnabled(true);
      expect(store.getState().enableMetrics).toBe(true);
    });
  });

  describe('setLogsEnabled', () => {
    it('enables logs', () => {
      const store = createTestStore({ enableLogs: false });
      store.getState().setLogsEnabled(true);
      expect(store.getState().enableLogs).toBe(true);
    });
  });

  describe('setConsoleInDevEnabled', () => {
    it('enables console in dev', () => {
      const store = createTestStore({ enableConsoleInDev: false });
      store.getState().setConsoleInDevEnabled(true);
      expect(store.getState().enableConsoleInDev).toBe(true);
    });
  });

  describe('setUserConsent', () => {
    it('sets consent to true', () => {
      const store = createTestStore();
      store.getState().setUserConsent(true);
      expect(store.getState().userConsent).toBe(true);
    });

    it('denying consent disables everything', () => {
      const store = createTestStore({
        isEnabled: true,
        enableMetrics: true,
        enableLogs: true,
      });
      store.getState().setUserConsent(false);
      expect(store.getState().userConsent).toBe(false);
      expect(store.getState().isEnabled).toBe(false);
      expect(store.getState().enableMetrics).toBe(false);
      expect(store.getState().enableLogs).toBe(false);
    });

    it('re-granting consent restores the env-derived flags', () => {
      const store = createTestStore();
      store.getState().setUserConsent(false);
      store.getState().setUserConsent(true);
      const state = store.getState();
      expect(state.userConsent).toBe(true);
      expect(state.isEnabled).toBe(initialTelemetryState.isEnabled);
      expect(state.enableMetrics).toBe(initialTelemetryState.enableMetrics);
      expect(state.enableLogs).toBe(initialTelemetryState.enableLogs);
    });
  });

  describe('getTelemetryConfig', () => {
    it('returns config reflecting current state', () => {
      const store = createTestStore({
        isEnabled: true,
        enableMetrics: true,
        enableLogs: false,
        enableConsoleInDev: true,
        userConsent: true,
      });
      const config = store.getState().getTelemetryConfig();
      expect(config.enabled).toBe(true);
      expect(config.enableMetrics).toBe(true);
      expect(config.enableLogs).toBe(false);
      expect(config.enableConsoleInDev).toBe(true);
    });

    it('returns disabled config when consent is false', () => {
      const store = createTestStore({
        isEnabled: true,
        enableMetrics: true,
        enableLogs: true,
        userConsent: false,
      });
      const config = store.getState().getTelemetryConfig();
      expect(config.enabled).toBe(false);
      expect(config.enableMetrics).toBe(false);
      expect(config.enableLogs).toBe(false);
    });

    it('returns disabled when isEnabled is false', () => {
      const store = createTestStore({
        isEnabled: false,
        enableMetrics: true,
        userConsent: true,
      });
      const config = store.getState().getTelemetryConfig();
      expect(config.enabled).toBe(false);
      expect(config.enableMetrics).toBe(false);
    });
  });

  describe('resetTelemetry', () => {
    it('resets to initial state', () => {
      const store = createTestStore({
        isEnabled: !initialTelemetryState.isEnabled,
        enableMetrics: !initialTelemetryState.enableMetrics,
        enableLogs: !initialTelemetryState.enableLogs,
        enableConsoleInDev: true,
        userConsent: false,
      });
      store.getState().resetTelemetry();
      const state = store.getState();
      expect(state.isEnabled).toBe(initialTelemetryState.isEnabled);
      expect(state.enableMetrics).toBe(initialTelemetryState.enableMetrics);
      expect(state.enableLogs).toBe(initialTelemetryState.enableLogs);
      expect(state.enableConsoleInDev).toBe(false);
      expect(state.userConsent).toBeNull();
    });
  });
});

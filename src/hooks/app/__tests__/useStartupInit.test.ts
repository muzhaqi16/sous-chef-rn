import { renderHook } from '@testing-library/react-native';
import { mockAppStore } from '#/test-utils/mockAppStore';
import { useStartupInit } from '../useStartupInit';

jest.mock('#store/useAppStore', () =>
  mockAppStore({
    isHydrated: true,
    setHasStoredCredentials: jest.fn(),
    getTelemetryConfig: jest.fn(() => ({})),
  }),
);

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({ user: null, accessToken: null })),
  },
}));

jest.mock('#services/authService', () => ({
  authService: { registerDeviceInBackground: jest.fn() },
}));

jest.mock('#services/telemetry', () => ({
  Telemetry: {
    updateConfig: jest.fn(),
    initialize: jest.fn(),
    trackEvent: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn(),
  },
}));

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: { initialize: jest.fn() },
}));

jest.mock('#/services/performance/NativePerformanceService', () => ({
  NativePerformanceService: { initialize: jest.fn(), cleanup: jest.fn() },
}));

jest.mock('#/services/performance/MemoryMonitor', () => ({
  MemoryMonitor: { start: jest.fn(), stop: jest.fn() },
}));

jest.mock('#storage/keychain', () => ({
  getLastBiometricEmail: jest.fn().mockResolvedValue(null),
  hasCredentials: jest.fn().mockResolvedValue(false),
}));

jest.mock('#/utils/deviceId', () => ({
  initializeDeviceId: jest.fn(),
}));

jest.mock('react-native-launch-arguments', () => ({
  LaunchArguments: { value: jest.fn(() => ({})) },
}));

const { useStore } = jest.requireMock('#store') as {
  useStore: { getState: jest.Mock };
};
const { authService } = jest.requireMock('#services/authService') as {
  authService: { registerDeviceInBackground: jest.Mock };
};

describe('useStartupInit — restored-session push registration', () => {
  beforeAll(() => {
    (
      global as unknown as { requestIdleCallback: (cb: () => void) => number }
    ).requestIdleCallback = (cb: () => void) => {
      cb();
      return 0;
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('schedules device registration when a restored session exists', () => {
    useStore.getState.mockReturnValue({
      user: { id: 'u-1' },
      accessToken: 'token-1',
    });

    renderHook(() => useStartupInit());

    expect(authService.registerDeviceInBackground).toHaveBeenCalledTimes(1);
  });

  it('does not register when the app starts unauthenticated', () => {
    useStore.getState.mockReturnValue({ user: null, accessToken: null });

    renderHook(() => useStartupInit());

    expect(authService.registerDeviceInBackground).not.toHaveBeenCalled();
  });

  it('does not register when only a stale user without token is present', () => {
    useStore.getState.mockReturnValue({
      user: { id: 'u-1' },
      accessToken: null,
    });

    renderHook(() => useStartupInit());

    expect(authService.registerDeviceInBackground).not.toHaveBeenCalled();
  });
});

describe('useStartupInit — the shared JS-entry origin', () => {
  afterEach(() => {
    delete (globalThis as { __APP_START_TIMESTAMP?: number })
      .__APP_START_TIMESTAMP;
  });

  it('leaves __APP_START_TIMESTAMP readable for later consumers', () => {
    // This hook reports `app_startup_duration_ms` at hydration and used to
    // clear the global afterwards as an HMR guard. But the same global is the
    // origin for `store/index.ts` and for
    // `NativePerformanceService.markFullyDrawn()`, which fires when the first
    // list finishes loading — seconds later. Clearing it made
    // `app_fully_drawn_ms` silently emit nothing on device.
    (
      globalThis as { __APP_START_TIMESTAMP?: number }
    ).__APP_START_TIMESTAMP = 1_000_000;

    renderHook(() => useStartupInit());

    expect(
      (globalThis as { __APP_START_TIMESTAMP?: number }).__APP_START_TIMESTAMP,
    ).toBe(1_000_000);
  });
});

describe('useStartupInit — the environment gate on launch-arg injection', () => {
  // Two defects live here. First, `Environment.isProduction` is a METHOD: read
  // without calling it the reference is always truthy, so the original
  // `!Environment.isProduction` was always false and injection never ran in any
  // build — a defect that passed typecheck, lint and the whole suite because
  // nothing asserted the injection path. Second, `!isProduction()` is a
  // denylist: it hands the launch-arg auth backdoor to every variant that
  // merely forgets to say it is production. The gate is now an allowlist on
  // `isDevelopment()`, so STAGING is the case that distinguishes the two — keep
  // that test, or a revert to `!isProduction()` passes silently.
  const { LaunchArguments } = jest.requireMock(
    'react-native-launch-arguments',
  ) as { LaunchArguments: { value: jest.Mock } };
  const { Environment } = jest.requireMock('#/utils/environment') as {
    Environment: { isProduction: jest.Mock; isDevelopment: jest.Mock };
  };
  const { Telemetry } = jest.requireMock('#services/telemetry') as {
    Telemetry: { updateConfig: jest.Mock };
  };
  const { NativePerformanceService } = jest.requireMock(
    '#/services/performance/NativePerformanceService',
  ) as { NativePerformanceService: { initialize: jest.Mock } };

  const storeActions = {
    setAuth: jest.fn(),
    setNavigationState: jest.fn(),
    setPantrySortOption: jest.fn(),
    setPantrySortDirection: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Environment.isDevelopment.mockReturnValue(true);
    Environment.isProduction.mockReturnValue(false);
    useStore.getState.mockReturnValue({
      user: null,
      accessToken: null,
      ...storeActions,
    });
  });

  afterEach(() => {
    LaunchArguments.value.mockReturnValue({});
  });

  it('injects the session in a development-flavoured build', () => {
    Environment.isDevelopment.mockReturnValue(true);
    LaunchArguments.value.mockReturnValue({
      detoxServer: 'ws://localhost:8099',
      detoxUserToken: 'access-1',
      detoxRefreshToken: 'refresh-1',
      detoxUser: { id: 'u-1' },
    });

    renderHook(() => useStartupInit());

    expect(storeActions.setAuth).toHaveBeenCalledWith(
      { id: 'u-1' },
      'access-1',
      'refresh-1',
    );
    // The root navigator gates its groups on navigationState — without this
    // the injected session still renders the auth group.
    expect(storeActions.setNavigationState).toHaveBeenCalledWith('main_app');
  });

  it('ignores launch arguments in a production build', () => {
    Environment.isDevelopment.mockReturnValue(false);
    Environment.isProduction.mockReturnValue(true);
    LaunchArguments.value.mockReturnValue({
      detoxUserToken: 'access-1',
      detoxRefreshToken: 'refresh-1',
      detoxUser: { id: 'u-1' },
    });

    renderHook(() => useStartupInit());

    expect(storeActions.setAuth).not.toHaveBeenCalled();
    expect(storeActions.setNavigationState).not.toHaveBeenCalled();
  });

  it('ignores launch arguments in a STAGING build', () => {
    // The case that separates an allowlist from a denylist. Staging is neither
    // development nor production, so `!isProduction()` would accept an injected
    // session on a build handed to testers, while `isDevelopment()` refuses it.
    // If this ever passes with the gate back on `!isProduction()`, the allowlist
    // has been reverted.
    Environment.isDevelopment.mockReturnValue(false);
    Environment.isProduction.mockReturnValue(false);
    LaunchArguments.value.mockReturnValue({
      detoxUserToken: 'access-1',
      detoxRefreshToken: 'refresh-1',
      detoxUser: { id: 'u-1' },
    });

    renderHook(() => useStartupInit());

    expect(storeActions.setAuth).not.toHaveBeenCalled();
    expect(storeActions.setNavigationState).not.toHaveBeenCalled();
  });

  it('suppresses telemetry when only background services are disabled', () => {
    LaunchArguments.value.mockReturnValue({
      detoxDisableBackgroundServices: 1,
    });

    renderHook(() => useStartupInit());

    expect(Telemetry.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enableLogs: false, enableMetrics: false }),
    );
    expect(NativePerformanceService.initialize).not.toHaveBeenCalled();
  });

  it('keeps telemetry when a measuring run asks for both', () => {
    // The two flags answer different questions: one stops timers that block
    // Detox's idle detection, the other keeps the run able to produce numbers.
    LaunchArguments.value.mockReturnValue({
      detoxDisableBackgroundServices: 1,
      detoxEnableTelemetry: 1,
    });

    renderHook(() => useStartupInit());

    expect(Telemetry.updateConfig).not.toHaveBeenCalledWith(
      expect.objectContaining({ enableLogs: false, enableMetrics: false }),
    );
    // Startup marks come from here; without it a measuring run reports no
    // app_native_launch_ms / app_js_bundle_load_ms.
    expect(NativePerformanceService.initialize).toHaveBeenCalled();
  });
});

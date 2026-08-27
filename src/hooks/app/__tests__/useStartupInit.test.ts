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
    increment: jest.fn(),
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

describe('useStartupInit — the build gate on launch-arg injection', () => {
  // Accepting an auth state from launch arguments is a NAMED capability with
  // its own default-off flag. Every gate this has worn before was a property of
  // something else and leaked: `!Environment.isProduction` was a method read
  // without calling it (always truthy, so injection never ran anywhere), then a
  // denylist that handed the capability to any variant merely forgetting to say
  // it was production, then `isDevelopment()` — which `.env`'s
  // `NODE_ENV=development` makes true in every LOCAL release build.
  //
  // So the cases worth holding are the flag being off by default, and the gate
  // reading nothing but the flag.
  const { LaunchArguments } = jest.requireMock(
    'react-native-launch-arguments',
  ) as { LaunchArguments: { value: jest.Mock } };
  const { Environment } = jest.requireMock('#/utils/environment') as {
    Environment: {
      isProduction: jest.Mock;
      isDevelopment: jest.Mock;
      allowsLaunchArgAuth: jest.Mock;
    };
  };
  const { Telemetry } = jest.requireMock('#services/telemetry') as {
    Telemetry: { updateConfig: jest.Mock };
  };
  const { NativePerformanceService } = jest.requireMock(
    '#/services/performance/NativePerformanceService',
  ) as {
    NativePerformanceService: { initialize: jest.Mock; cleanup: jest.Mock };
  };
  const { MemoryMonitor } = jest.requireMock(
    '#/services/performance/MemoryMonitor',
  ) as { MemoryMonitor: { start: jest.Mock } };

  const storeActions = {
    setAuth: jest.fn(),
    setNavigationState: jest.fn(),
    setPantrySortOption: jest.fn(),
    setPantrySortDirection: jest.fn(),
  };

  // Installed and restored HERE rather than borrowed from a sibling describe.
  // The idle callback is what runs the deferred init these tests assert on, and
  // depending on another block's `beforeAll` made the positive assertions fail
  // when this file was run with a `-t` filter and the negative ones pass
  // vacuously — a guard that reports the opposite of the truth depending on
  // which other tests ran.
  let realRequestIdleCallback: typeof global.requestIdleCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    realRequestIdleCallback = (
      global as unknown as {
        requestIdleCallback: typeof global.requestIdleCallback;
      }
    ).requestIdleCallback;
    (
      global as unknown as { requestIdleCallback: (cb: () => void) => number }
    ).requestIdleCallback = (cb: () => void) => {
      cb();
      return 0;
    };
    Environment.allowsLaunchArgAuth.mockReturnValue(true);
    useStore.getState.mockReturnValue({
      user: null,
      accessToken: null,
      ...storeActions,
    });
  });

  afterEach(() => {
    (
      global as unknown as {
        requestIdleCallback: typeof global.requestIdleCallback;
      }
    ).requestIdleCallback = realRequestIdleCallback;
    LaunchArguments.value.mockReturnValue({});
  });

  it('injects the session when the build enables the capability', () => {
    Environment.allowsLaunchArgAuth.mockReturnValue(true);
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

  it('ignores launch arguments when the capability is off', () => {
    Environment.allowsLaunchArgAuth.mockReturnValue(false);
    LaunchArguments.value.mockReturnValue({
      detoxUserToken: 'access-1',
      detoxRefreshToken: 'refresh-1',
      detoxUser: { id: 'u-1' },
    });

    renderHook(() => useStartupInit());

    expect(storeActions.setAuth).not.toHaveBeenCalled();
    expect(storeActions.setNavigationState).not.toHaveBeenCalled();
  });

  it('ignores launch arguments in a development-flavoured build that did not opt in', () => {
    // The case every previous gate got wrong. A local RELEASE build resolves
    // `isDevelopment()` true, because `.env` carries `NODE_ENV=development` and
    // every release variant falls through to it — so a gate reading the
    // environment accepts an injected session here. Only the flag may decide.
    Environment.isDevelopment.mockReturnValue(true);
    Environment.isProduction.mockReturnValue(false);
    Environment.allowsLaunchArgAuth.mockReturnValue(false);
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

    const { unmount } = renderHook(() => useStartupInit());

    expect(Telemetry.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enableLogs: false, enableMetrics: false }),
    );
    expect(NativePerformanceService.initialize).not.toHaveBeenCalled();

    unmount();
    expect(NativePerformanceService.cleanup).not.toHaveBeenCalled();
  });

  it('keeps telemetry when a measuring run asks for both', () => {
    // The two flags answer different questions: one stops timers that block
    // Detox's idle detection, the other keeps the run able to produce numbers.
    LaunchArguments.value.mockReturnValue({
      detoxDisableBackgroundServices: 1,
      detoxEnableTelemetry: 1,
    });

    const { unmount } = renderHook(() => useStartupInit());

    expect(Telemetry.updateConfig).not.toHaveBeenCalledWith(
      expect.objectContaining({ enableLogs: false, enableMetrics: false }),
    );
    // Startup marks come from here; without it a measuring run reports no
    // app_native_launch_ms / app_js_bundle_load_ms.
    expect(NativePerformanceService.initialize).toHaveBeenCalled();

    // Whatever init started, cleanup has to stop — the two guards read the
    // same pair of flags, and a divergence leaks the observers it attached.
    unmount();
    expect(NativePerformanceService.cleanup).toHaveBeenCalled();
  });

  it('installs no repeating timer on a measuring run', () => {
    // `detoxDisableBackgroundServices` exists to stop timers that block Detox's
    // idle detection, and MemoryMonitor's 10 s snapshot interval is the app's
    // only one. Re-enabling telemetry for a measuring run must not drag it back
    // in — these two flags answer different questions.
    LaunchArguments.value.mockReturnValue({
      detoxDisableBackgroundServices: 1,
      detoxEnableTelemetry: 1,
    });

    renderHook(() => useStartupInit());

    expect(NativePerformanceService.initialize).toHaveBeenCalled();
    expect(MemoryMonitor.start).not.toHaveBeenCalled();
  });
});

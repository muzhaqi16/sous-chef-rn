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

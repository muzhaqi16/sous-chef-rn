import { renderHook } from '@testing-library/react-native';
import { mockAppStore } from '#/test-utils/mockAppStore';
import { useCoreStartup } from '#bootstrap/useCoreStartup';
import { useMobileStartupHost } from '../mobileStartupHost';

/** The start-up the mobile root runs: the core's, with this device's steps. */
const useStartupInit = () => useCoreStartup(useMobileStartupHost());

/**
 * The order start-up depends on, whichever side of the core a step sits on:
 * launch-argument injection first (it signs an end-to-end run in and turns its
 * telemetry off), the device identity before what reports or registers, and
 * telemetry configured, then started, then reporting. Each step runs once.
 */
const calls: string[] = [];
const record =
  (name: string, result?: unknown) =>
  (...args: unknown[]) => {
    const [first] = args;
    calls.push(
      typeof first === 'string' && name.endsWith('.') ? name + first : name,
    );
    return result;
  };

jest.mock('#store/useAppStore', () =>
  mockAppStore({
    isHydrated: true,
    setHasStoredCredentials: jest.fn(),
    getTelemetryConfig: jest.fn(() => ({})),
  }),
);

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      user: { id: 'u-1' },
      accessToken: 'token-1',
      setAuth: jest.fn(),
      setNavigationState: jest.fn(),
    })),
  },
}));

jest.mock('react-native-launch-arguments', () => ({
  LaunchArguments: { value: jest.fn() },
}));
jest.mock('#/services/auth/deviceId', () => ({ ensureDeviceId: jest.fn() }));
jest.mock('#/apollo/offlineQueue/queueFailureHandler', () => ({
  registerQueueFailureHandler: jest.fn(),
}));
jest.mock('#native/storage/keychain', () => ({
  getLastBiometricEmail: jest.fn(),
  hasCredentials: jest.fn(),
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
jest.mock('#/services/device/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));

const mocked = <T extends object>(path: string): T => jest.requireMock<T>(path);

beforeEach(() => {
  calls.length = 0;
  const { LaunchArguments } = mocked<{
    LaunchArguments: { value: jest.Mock };
  }>('react-native-launch-arguments');
  LaunchArguments.value.mockImplementation(record('launchArguments', {}));
  mocked<{ Environment: { allowsLaunchArgAuth: jest.Mock } }>(
    '#/utils/environment',
  ).Environment.allowsLaunchArgAuth.mockReturnValue(true);
  mocked<{ ensureDeviceId: jest.Mock }>(
    '#/services/auth/deviceId',
  ).ensureDeviceId.mockImplementation(
    record('deviceId', Promise.resolve('device-1')),
  );
  mocked<{ registerQueueFailureHandler: jest.Mock }>(
    '#/apollo/offlineQueue/queueFailureHandler',
  ).registerQueueFailureHandler.mockImplementation(
    record('queueFailureHandler'),
  );
  const keychain = mocked<Record<string, jest.Mock>>(
    '#native/storage/keychain',
  );
  keychain.getLastBiometricEmail!.mockImplementation(
    record('storedCredentialCheck', Promise.resolve(null)),
  );
  const { Telemetry } = mocked<{ Telemetry: Record<string, jest.Mock> }>(
    '#services/telemetry',
  );
  Telemetry.updateConfig!.mockImplementation(record('telemetry.configure'));
  Telemetry.initialize!.mockImplementation(record('telemetry.start'));
  Telemetry.increment!.mockImplementation(record('telemetry.'));
  Telemetry.histogram!.mockImplementation(record('telemetry.'));
  Telemetry.trackEvent!.mockImplementation(record('telemetry.'));
  mocked<{ HapticService: { initialize: jest.Mock } }>(
    '#services/haptic/HapticService',
  ).HapticService.initialize.mockImplementation(record('haptics'));
  mocked<{ NativePerformanceService: { initialize: jest.Mock } }>(
    '#/services/performance/NativePerformanceService',
  ).NativePerformanceService.initialize.mockImplementation(
    record('nativePerformance'),
  );
  mocked<{ registerDeviceInBackground: jest.Mock }>(
    '#/services/device/deviceRegistration',
  ).registerDeviceInBackground.mockImplementation(record('deviceRegistration'));
  (
    globalThis as { requestIdleCallback?: (callback: () => void) => number }
  ).requestIdleCallback = callback => {
    callback();
    return 0;
  };
});

const before = (first: string, second: string) => {
  expect(steps()).toContain(first);
  expect(steps()).toContain(second);
  expect(steps().indexOf(first)).toBeLessThan(steps().indexOf(second));
};

// `app_startup_duration_ms` reports once per process, not per mount, so only
// the first render here would see it: its own suite holds it.
const steps = () =>
  calls.filter(call => call !== 'telemetry.app_startup_duration_ms');

it('runs each start-up step once', () => {
  renderHook(() => useStartupInit());

  expect([...steps()].sort()).toEqual(
    [
      'launchArguments',
      'deviceId',
      'queueFailureHandler',
      'storedCredentialCheck',
      'telemetry.configure',
      'telemetry.start',
      'telemetry.app_starts_total',
      'telemetry.app_launched',
      'haptics',
      'nativePerformance',
      'deviceRegistration',
    ].sort(),
  );
});

it('injects launch arguments before the core reads the session or telemetry', () => {
  renderHook(() => useStartupInit());

  before('launchArguments', 'deviceId');
  before('launchArguments', 'queueFailureHandler');
  before('launchArguments', 'telemetry.configure');
});

it('configures telemetry, then starts it, then reports through it', () => {
  renderHook(() => useStartupInit());

  before('telemetry.configure', 'telemetry.start');
  before('telemetry.start', 'telemetry.app_starts_total');
  before('telemetry.start', 'telemetry.app_launched');
  before('telemetry.start', 'haptics');
  before('telemetry.start', 'nativePerformance');
});

it('settles the device identity before registering the device', () => {
  renderHook(() => useStartupInit());

  before('deviceId', 'deviceRegistration');
});

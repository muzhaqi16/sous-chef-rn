jest.mock('#native/storage/keychain', () =>
  jest.requireActual('#/test-utils/memoryKeychain').memoryKeychainModule(),
);
// Registering the device runs in the background over native device APIs;
// `deviceRegistration.test.ts` covers it.
jest.mock('#/services/device/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));
jest.mock('react-native-launch-arguments', () => ({
  LaunchArguments: { value: jest.fn() },
}));

import { act, renderHook } from '@testing-library/react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import { useStore } from '#store';
import { Environment } from '#/utils/environment';
import { Telemetry } from '#services/telemetry';
import { HapticService } from '#services/haptic/HapticService';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import { registerDeviceInBackground } from '#/services/device/deviceRegistration';
import * as deviceIdentity from '#/services/auth/deviceId';
import * as queueFailures from '#/apollo/offlineQueue/queueFailureHandler';
import * as keychain from '#native/storage/keychain';
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
  <T>(name: string, result: T) =>
  (...args: unknown[]): T => {
    const [first] = args;
    calls.push(
      typeof first === 'string' && name.endsWith('.') ? name + first : name,
    );
    return result;
  };

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  calls.length = 0;
  useStore.setState({
    isHydrated: true,
    user: {
      id: 'u-1',
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
  });
  jest
    .mocked(LaunchArguments.value)
    .mockImplementation(record('launchArguments', {}));
  jest.mocked(Environment.allowsLaunchArgAuth).mockReturnValue(true);
  jest
    .spyOn(deviceIdentity, 'ensureDeviceId')
    .mockImplementation(record('deviceId', Promise.resolve('device-1')));
  jest
    .spyOn(queueFailures, 'registerQueueFailureHandler')
    .mockImplementation(record('queueFailureHandler', undefined));
  jest
    .spyOn(keychain, 'getLastBiometricEmail')
    .mockImplementation(record('storedCredentialCheck', Promise.resolve(null)));
  jest
    .mocked(Telemetry.updateConfig)
    .mockImplementation(record('telemetry.configure', undefined));
  jest
    .mocked(Telemetry.initialize)
    .mockImplementation(record('telemetry.start', undefined));
  jest
    .mocked(Telemetry.increment)
    .mockImplementation(record('telemetry.', undefined));
  jest
    .mocked(Telemetry.histogram)
    .mockImplementation(record('telemetry.', undefined));
  jest
    .mocked(Telemetry.trackEvent)
    .mockImplementation(record('telemetry.', undefined));
  jest
    .spyOn(HapticService, 'initialize')
    .mockImplementation(record('haptics', undefined));
  jest
    .spyOn(NativePerformanceService, 'initialize')
    .mockImplementation(record('nativePerformance', undefined));
  jest
    .spyOn(NativePerformanceService, 'cleanup')
    .mockImplementation(record('nativePerformance.stop', undefined));
  jest
    .mocked(registerDeviceInBackground)
    .mockImplementation(record('deviceRegistration', undefined));
  jest.spyOn(globalThis, 'requestIdleCallback').mockImplementation(callback => {
    callback({ didTimeout: false, timeRemaining: () => 50 });
    return 0;
  });
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

const START_UP = [
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
].sort();

it('runs each start-up step once', () => {
  renderHook(() => useStartupInit());

  expect([...steps()].sort()).toEqual(START_UP);
});

it('waits for the store to hydrate', () => {
  useStore.setState({ isHydrated: false });
  renderHook(() => useStartupInit());
  expect(steps()).toEqual([]);

  act(() => {
    useStore.setState({ isHydrated: true });
  });

  // The pre-hydration run's cleanup stops a host that never started, which
  // stops nothing: hydration never resets, so no stop follows a start.
  expect(
    steps()
      .filter(step => step !== 'nativePerformance.stop')
      .sort(),
  ).toEqual(START_UP);
});

it('starts once, however often hydration is re-reported', () => {
  renderHook(() => useStartupInit());

  act(() => {
    useStore.setState({ isHydrated: false });
  });
  act(() => {
    useStore.setState({ isHydrated: true });
  });

  expect(steps().filter(step => step === 'telemetry.start')).toHaveLength(1);
});

it('stops the host when the root goes', () => {
  const { unmount } = renderHook(() => useStartupInit());

  unmount();

  expect(steps()).toContain('nativePerformance.stop');
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

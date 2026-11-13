jest.mock('#native/storage/keychain', () =>
  jest.requireActual('#/test-utils/memoryKeychain').memoryKeychainModule(),
);
// Registering the device runs in the background over native device APIs;
// `deviceRegistration.test.ts` covers it.
jest.mock('#/services/device/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));
jest.mock('react-native-launch-arguments', () => ({
  LaunchArguments: { value: jest.fn(() => ({})) },
}));

import { renderHook } from '@testing-library/react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import { useStore } from '#store';
import { Environment } from '#/utils/environment';
import { Telemetry } from '#services/telemetry';
import { HapticService } from '#services/haptic/HapticService';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { registerDeviceInBackground } from '#/services/device/deviceRegistration';
import { memoryKeychain } from '#/test-utils/memoryKeychain';
import { settledInAct } from '#/test-utils/settledInAct';
import { saveLastBiometricEmail } from '#native/storage/keychain';
import { useCoreStartup } from '#bootstrap/useCoreStartup';
import { useMobileStartupHost } from '../mobileStartupHost';

/** The start-up the mobile root runs: the core's, with this device's steps. */
const useStartupInit = () => useCoreStartup(useMobileStartupHost());

const launchedWith = (args: Record<string, unknown>) => {
  jest.mocked(LaunchArguments.value).mockReturnValue(args);
};

/** Starts the app, the idle work run at once, as an idle device runs it. */
const start = () => {
  jest.spyOn(globalThis, 'requestIdleCallback').mockImplementation(callback => {
    callback({ didTimeout: false, timeRemaining: () => 50 });
    return 0;
  });
  return renderHook(() => useStartupInit());
};

const SIGNED_IN = {
  user: {
    id: 'u-1',
    email: 'cook@example.com',
    emailVerified: true,
    onBoarded: true,
  },
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  memoryKeychain.reset();
  launchedWith({});
  jest.mocked(Environment.allowsLaunchArgAuth).mockReturnValue(false);
  jest.spyOn(HapticService, 'initialize').mockImplementation(() => undefined);
  jest
    .spyOn(NativePerformanceService, 'initialize')
    .mockImplementation(() => undefined);
  jest
    .spyOn(NativePerformanceService, 'cleanup')
    .mockImplementation(() => undefined);
  jest.spyOn(MemoryMonitor, 'start').mockImplementation(() => undefined);
  jest.spyOn(MemoryMonitor, 'stop').mockImplementation(() => undefined);
  useStore.getState().clearAuth();
  useStore.setState({ isHydrated: true, hasStoredCredentials: null });
});

describe('a restored session', () => {
  it('registers the device', () => {
    useStore.setState(SIGNED_IN);

    start();

    expect(registerDeviceInBackground).toHaveBeenCalledTimes(1);
  });

  it('is not registered from a signed-out start', () => {
    start();

    expect(registerDeviceInBackground).not.toHaveBeenCalled();
  });

  it('is not registered from a stale user with no token', () => {
    useStore.setState({ user: SIGNED_IN.user });

    start();

    expect(registerDeviceInBackground).not.toHaveBeenCalled();
  });

  it('is not registered on an end-to-end run with background services off', () => {
    jest.mocked(Environment.allowsLaunchArgAuth).mockReturnValue(true);
    launchedWith({ detoxDisableBackgroundServices: 1 });
    useStore.setState(SIGNED_IN);

    start();

    expect(registerDeviceInBackground).not.toHaveBeenCalled();
  });
});

describe('the stored sign-in button', () => {
  it('is taken down when no biometric sign-in is held', async () => {
    start();
    await settledInAct(async () => undefined);

    expect(useStore.getState().hasStoredCredentials).toBe(false);
  });

  it('is offered for the account whose sign-in the device holds', async () => {
    await saveLastBiometricEmail('cook@example.com');
    memoryKeychain.hold('cook@example.com', 'dc1:secret');

    start();
    await settledInAct(async () => undefined);

    expect(useStore.getState().hasStoredCredentials).toBe(true);
  });
});

describe('the shared JS-entry origin', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__APP_START_TIMESTAMP');
  });

  // The same global is the origin for `NativePerformanceService.markFullyDrawn()`,
  // which fires seconds later: clearing it here would silence that metric.
  it('is left readable for later consumers', () => {
    Reflect.set(globalThis, '__APP_START_TIMESTAMP', 1_000_000);

    start();

    expect(Reflect.get(globalThis, '__APP_START_TIMESTAMP')).toBe(1_000_000);
  });
});

// Accepting an auth state from launch arguments is a NAMED capability with its
// own default-off flag: every gate it wore before was a property of something
// else and leaked. So the flag alone decides.
describe('launch-argument injection', () => {
  const SESSION_ARGS = {
    detoxServer: 'ws://localhost:8099',
    detoxUserToken: 'access-1',
    detoxRefreshToken: 'refresh-1',
    detoxUser: { id: 'u-1' },
  };

  it('signs the session in and opens the app when the build enables it', () => {
    jest.mocked(Environment.allowsLaunchArgAuth).mockReturnValue(true);
    launchedWith(SESSION_ARGS);

    start();

    const state = useStore.getState();
    expect(state.user?.id).toBe('u-1');
    expect(state.accessToken).toBe('access-1');
    expect(state.navigationState).toBe('main_app');
  });

  it('is ignored when the capability is off', () => {
    launchedWith(SESSION_ARGS);

    start();

    expect(useStore.getState().user).toBeNull();
  });

  it('is ignored in a development-flavoured build that did not opt in', () => {
    // A local RELEASE build resolves `isDevelopment()` true, so a gate reading
    // the environment would accept an injected session here.
    jest.mocked(Environment.isDevelopment).mockReturnValue(true);
    jest.mocked(Environment.isProduction).mockReturnValue(false);
    launchedWith(SESSION_ARGS);

    start();

    expect(useStore.getState().user).toBeNull();
  });

  it('suppresses telemetry when only background services are disabled', () => {
    jest.mocked(Environment.allowsLaunchArgAuth).mockReturnValue(true);
    launchedWith({ detoxDisableBackgroundServices: 1 });

    const { unmount } = start();

    expect(Telemetry.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enableLogs: false, enableMetrics: false }),
    );
    expect(NativePerformanceService.initialize).not.toHaveBeenCalled();
    unmount();
    expect(NativePerformanceService.cleanup).not.toHaveBeenCalled();
  });

  // One flag stops timers that block Detox's idle detection; the other keeps a
  // measuring run able to produce numbers.
  it('keeps telemetry, and no repeating timer, when a measuring run asks for both', () => {
    jest.mocked(Environment.allowsLaunchArgAuth).mockReturnValue(true);
    launchedWith({
      detoxDisableBackgroundServices: 1,
      detoxEnableTelemetry: 1,
    });

    const { unmount } = start();

    expect(Telemetry.updateConfig).not.toHaveBeenCalledWith(
      expect.objectContaining({ enableLogs: false, enableMetrics: false }),
    );
    expect(NativePerformanceService.initialize).toHaveBeenCalled();
    expect(MemoryMonitor.start).not.toHaveBeenCalled();
    unmount();
    expect(NativePerformanceService.cleanup).toHaveBeenCalled();
  });
});

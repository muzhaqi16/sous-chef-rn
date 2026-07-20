import { Platform } from 'react-native';
import type { PushTokenProvider } from '../pushTokenProvider';

const mockRequestPermissions = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

jest.mock('@react-native-community/push-notification-ios', () => ({
  __esModule: true,
  default: {
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
    removeEventListener: (...args: unknown[]) =>
      mockRemoveEventListener(...args),
  },
}));

const setPlatform = (os: 'android' | 'ios') => {
  Object.defineProperty(Platform, 'OS', { value: os, writable: true });
};

/** The persistent 'register' handler the provider attached to the native module. */
const getRegisterHandler = (): ((token: string) => void) => {
  const call = mockAddEventListener.mock.calls.find(c => c[0] === 'register');
  return call?.[1] as (token: string) => void;
};

/** The persistent 'registrationError' handler the provider attached. */
const getRegistrationErrorHandler = (): ((error: unknown) => void) => {
  const call = mockAddEventListener.mock.calls.find(
    c => c[0] === 'registrationError',
  );
  return call?.[1] as (error: unknown) => void;
};

describe('iosPushProvider', () => {
  let provider: PushTokenProvider;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    setPlatform('ios');
    mockRequestPermissions.mockResolvedValue({
      alert: true,
      badge: true,
      sound: true,
    });
    // Fresh module state (the provider caches token + listeners at module scope).
    provider = require('../iosPushProvider').iosPushProvider;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('on Android', () => {
    beforeEach(() => setPlatform('android'));

    it('is inert and never touches the iOS native module', async () => {
      await expect(provider.requestPermission()).resolves.toBe(false);
      await expect(provider.getToken()).resolves.toBeNull();
      expect(provider.onTokenRefresh(jest.fn())).toBeInstanceOf(Function);
      expect(mockRequestPermissions).not.toHaveBeenCalled();
      expect(mockAddEventListener).not.toHaveBeenCalled();
    });
  });

  describe('requestPermission', () => {
    it('returns true when any permission is granted', async () => {
      await expect(provider.requestPermission()).resolves.toBe(true);
      expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    });

    it('returns false when all permissions are denied', async () => {
      mockRequestPermissions.mockResolvedValue({
        alert: false,
        badge: false,
        sound: false,
      });
      await expect(provider.requestPermission()).resolves.toBe(false);
    });

    it('returns false and logs when requestPermissions throws', async () => {
      mockRequestPermissions.mockRejectedValue(new Error('denied'));
      await expect(provider.requestPermission()).resolves.toBe(false);
    });
  });

  describe('getToken', () => {
    it('resolves with the token delivered by the register event', async () => {
      await provider.requestPermission();
      const pending = provider.getToken();
      getRegisterHandler()('apns-token-abc');
      await expect(pending).resolves.toBe('apns-token-abc');
    });

    it('returns the cached token without waiting on later calls', async () => {
      await provider.requestPermission();
      getRegisterHandler()('apns-token-xyz');
      await expect(provider.getToken()).resolves.toBe('apns-token-xyz');
    });

    it('resolves null if no token arrives before the timeout', async () => {
      await provider.requestPermission();
      const pending = provider.getToken();
      jest.advanceTimersByTime(10000);
      await expect(pending).resolves.toBeNull();
    });

    it('resolves null immediately on registrationError, without waiting out the timeout', async () => {
      await provider.requestPermission();
      const pending = provider.getToken();
      // No timer advance — the error settles the pending resolver right away.
      getRegistrationErrorHandler()(new Error('APNs registration failed'));
      await expect(pending).resolves.toBeNull();
    });
  });

  describe('onTokenRefresh', () => {
    it('notifies subscribers on token rotation and unsubscribes cleanly', async () => {
      await provider.requestPermission();
      const listener = jest.fn();
      const unsubscribe = provider.onTokenRefresh(listener);

      getRegisterHandler()('token-1');
      expect(listener).toHaveBeenCalledWith('token-1');

      unsubscribe();
      getRegisterHandler()('token-2');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});

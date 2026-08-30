/**
 * iOS push-token provider — APNs directly, no Firebase. The library PUSHES the
 * token through a `register` event while `PushTokenProvider` is pull-based, so a
 * persistent listener caches it and `getToken()` returns the cache or waits.
 * Android uses `nativePushProvider`; startup injects the right one per platform.
 */

import { Platform } from 'react-native';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { logger } from '#/utils/environment';
import type { PushTokenProvider } from './pushTokenProvider';

/** Upper bound for how long getToken() waits for the APNs `register` event. */
const TOKEN_WAIT_MS = 10000;

let cachedToken: string | null = null;
let listenersReady = false;
const refreshListeners = new Set<(token: string) => void>();
const pendingResolvers = new Set<(token: string | null) => void>();

function handleRegister(deviceToken: string): void {
  cachedToken = deviceToken;
  // Copy before iterating: the resolvers delete themselves on settle.
  [...pendingResolvers].forEach(settle => settle(deviceToken));
  refreshListeners.forEach(listener => listener(deviceToken));
}

function handleRegistrationError(error: unknown): void {
  logger.error('APNs registration failed:', error);
  // No token is coming — settle every pending getToken() with null now instead
  // of leaving it to expire on the TOKEN_WAIT_MS timeout.
  [...pendingResolvers].forEach(settle => settle(null));
}

/**
 * Attaches the APNs listeners once, so a token arriving between
 * requestPermission() and getToken() is not missed.
 */
function ensureListeners(): void {
  if (listenersReady) return;
  listenersReady = true;
  try {
    PushNotificationIOS.addEventListener('register', handleRegister);
    PushNotificationIOS.addEventListener(
      'registrationError',
      handleRegistrationError,
    );
  } catch (error) {
    listenersReady = false;
    logger.error('APNs listener registration failed:', error);
  }
}

export const iosPushProvider: PushTokenProvider = {
  async requestPermission() {
    if (Platform.OS !== 'ios') return false;
    ensureListeners();
    try {
      // requestPermissions() also triggers registerForRemoteNotifications, so
      // the APNs token is delivered via the `register` event shortly after.
      const permissions = await PushNotificationIOS.requestPermissions();
      return Boolean(
        permissions.alert || permissions.badge || permissions.sound,
      );
    } catch (error) {
      logger.error('APNs requestPermissions failed:', error);
      return false;
    }
  },

  async getToken() {
    if (Platform.OS !== 'ios') return null;
    if (cachedToken) return cachedToken;
    ensureListeners();
    return new Promise<string | null>(resolve => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        pendingResolvers.delete(settle);
        resolve(value);
      };
      pendingResolvers.add(settle);
      timeoutId = setTimeout(() => settle(cachedToken), TOKEN_WAIT_MS);
    });
  },

  onTokenRefresh(listener) {
    if (Platform.OS !== 'ios') return () => {};
    ensureListeners();
    refreshListeners.add(listener);
    return () => {
      refreshListeners.delete(listener);
    };
  },
};

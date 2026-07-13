/**
 * Native push-token provider.
 *
 * Android: FCM via @react-native-firebase/messaging (modular API).
 * iOS: added when the iOS/APNs side is set up (push-notification-ios); until
 *      then iOS falls through to no token.
 *
 * Every method is defensive: if the native module isn't present in the running
 * binary (e.g. before a native rebuild picks up the new dependency), it degrades
 * to the no-op behavior (null token / no permission) instead of crashing.
 */

import { Platform } from 'react-native';
// Notification permission is requested through the shared PermissionService
// (Notifee + POST_NOTIFICATIONS on Android 13+) rather than the messaging
// module's own permission API, which react-native-firebase deprecated in favor
// of a dedicated permissions library. See invertase/react-native-firebase#6283.
// The token plumbing below (getMessaging / getToken / onTokenRefresh) is not
// deprecated and stays on the messaging modular API.
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import { PermissionService } from '#/services/permissions/PermissionService';
import { logger } from '#/utils/environment';
import type { PushTokenProvider } from './pushTokenProvider';

export const nativePushProvider: PushTokenProvider = {
  async requestPermission() {
    if (Platform.OS !== 'android') return false;
    try {
      const status = await PermissionService.request('notifications');
      return status === 'granted';
    } catch (error) {
      logger.error('FCM requestPermission failed:', error);
      return false;
    }
  },

  async getToken() {
    if (Platform.OS !== 'android') return null;
    try {
      return await getToken(getMessaging());
    } catch (error) {
      logger.error('FCM getToken failed:', error);
      return null;
    }
  },

  onTokenRefresh(listener) {
    if (Platform.OS !== 'android') return () => {};
    try {
      return onTokenRefresh(getMessaging(), listener);
    } catch (error) {
      logger.error('FCM onTokenRefresh subscribe failed:', error);
      return () => {};
    }
  },
};

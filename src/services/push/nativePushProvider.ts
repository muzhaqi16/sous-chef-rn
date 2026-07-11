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
// NOTE: react-native-firebase v25 JSDoc-marks its messaging API
// (getMessaging / requestPermission / AuthorizationStatus) as deprecated ahead
// of a future redesign, but there is no non-deprecated equivalent in this
// version — the `no-deprecated` lint warnings here are unavoidable and benign.
// See invertase/react-native-firebase#6283.
import {
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { logger } from '#/utils/environment';
import type { PushTokenProvider } from './pushTokenProvider';

export const nativePushProvider: PushTokenProvider = {
  async requestPermission() {
    if (Platform.OS !== 'android') return false;
    try {
      const status = await requestPermission(getMessaging());
      return (
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL
      );
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

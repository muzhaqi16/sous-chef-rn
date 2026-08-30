/**
 * Android push-token provider: FCM via @react-native-firebase/messaging. iOS has
 * its own (`iosPushProvider`), so every method here returns the no-op value off
 * Android, and also when the native module is missing from the running binary.
 */

import { Platform } from 'react-native';
// Permission goes through PermissionService, not the messaging module's own
// permission API, which react-native-firebase deprecated. The token plumbing
// below is NOT deprecated. See invertase/react-native-firebase#6283.
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

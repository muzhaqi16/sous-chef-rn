import { Platform, Linking, PermissionsAndroid } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  type PermissionStatus as RNPermissionStatus,
} from 'react-native-permissions';
import notifee, { AuthorizationStatus } from '@notifee/react-native';

export type AppPermission = 'camera' | 'notifications' | 'photoLibrary';

export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'undetermined';

function normalizeRNPermissionStatus(
  status: RNPermissionStatus,
): PermissionStatus {
  switch (status) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
    case RESULTS.UNAVAILABLE:
      return 'blocked';
    default:
      return 'undetermined';
  }
}

function getPlatformPermission(permission: 'camera' | 'photoLibrary') {
  const map = {
    camera: Platform.select({
      ios: PERMISSIONS.IOS.CAMERA,
      android: PERMISSIONS.ANDROID.CAMERA,
    }),
    photoLibrary: Platform.select({
      ios: PERMISSIONS.IOS.PHOTO_LIBRARY,
      android:
        Number(Platform.Version) >= 33
          ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
    }),
  };
  return map[permission]!;
}

class PermissionServiceClass {
  async check(permission: AppPermission): Promise<PermissionStatus> {
    if (permission === 'notifications') {
      return this.checkNotifications();
    }
    const platformPermission = getPlatformPermission(permission);
    const result = await check(platformPermission);
    return normalizeRNPermissionStatus(result);
  }

  async request(permission: AppPermission): Promise<PermissionStatus> {
    const currentStatus = await this.check(permission);
    if (currentStatus === 'granted') return 'granted';
    if (currentStatus === 'blocked') return 'blocked';

    if (permission === 'notifications') {
      return this.requestNotifications();
    }
    const platformPermission = getPlatformPermission(permission);
    const result = await request(platformPermission);
    return normalizeRNPermissionStatus(result);
  }

  async openSettings(): Promise<void> {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  }

  private async checkNotifications(): Promise<PermissionStatus> {
    if (Platform.OS === 'ios') {
      const settings = await notifee.getNotificationSettings();
      switch (settings.authorizationStatus) {
        case AuthorizationStatus.AUTHORIZED:
        case AuthorizationStatus.PROVISIONAL:
          return 'granted';
        case AuthorizationStatus.DENIED:
          return 'blocked';
        default:
          return 'undetermined';
      }
    }
    // Android 13+ requires POST_NOTIFICATIONS permission
    if (Number(Platform.Version) >= 33) {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return granted ? 'granted' : 'denied';
    }
    return 'granted';
  }

  private async requestNotifications(): Promise<PermissionStatus> {
    if (Platform.OS === 'ios') {
      const settings = await notifee.requestPermission();
      return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED
        ? 'granted'
        : 'blocked';
    }
    if (Number(Platform.Version) >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : 'blocked';
    }
    return 'granted';
  }
}

export const PermissionService = new PermissionServiceClass();

import {useCallback, useEffect, useState} from 'react';
import {Platform, PermissionsAndroid} from 'react-native';
import notifee, {AuthorizationStatus} from '@notifee/react-native';

export const useNotificationPermissions = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'ios') {
      const settings = await notifee.getNotificationSettings();
      setHasPermission(
        settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED,
      );
    } else {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      setHasPermission(granted);
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const settings = await notifee.requestPermission();
      const granted =
        settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
      setHasPermission(granted);
      return granted;
    } else if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      setHasPermission(isGranted);
      return isGranted;
    }
    return true;
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return {
    hasPermission,
    requestPermissions,
    checkPermissions,
  };
};

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { authService } from '#/services/authService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

/**
 * A permission changed in system settings reaches the server only from here:
 * registration carries the push token when permission is granted and clears the
 * stored one when it is not, so either direction is delivered by the same call.
 */
const syncPermissionChange = async (
  checkPermissions: () => Promise<boolean>,
  wasGranted: boolean | null,
  pushEnabled: boolean,
): Promise<void> => {
  const granted = await checkPermissions();
  if (wasGranted === null || granted === wasGranted || !pushEnabled) return;
  authService.registerDeviceInBackground();
};

interface ResyncOptions {
  checkPermissions: () => Promise<boolean>;
  hasPermission: boolean | null;
  pushEnabled: boolean;
}

/**
 * Re-reads the notification permission when the screen regains focus and when
 * the app returns from the background — the way back from system settings —
 * and reports a change to the server.
 */
export const useResyncPermissionOnReturn = ({
  checkPermissions,
  hasPermission,
  pushEnabled,
}: ResyncOptions) => {
  const { navigation } = useAppNavigation();
  const { addListener } = navigation;
  const appState = useRef(AppState.currentState);

  // Check permission status when screen comes into focus
  useEffect(() => {
    const checkPermsOnFocus = addListener('focus', () => {
      void syncPermissionChange(checkPermissions, hasPermission, pushEnabled);
    });

    return checkPermsOnFocus;
  }, [addListener, checkPermissions, hasPermission, pushEnabled]);

  // Re-check permissions when returning from device settings (background -> active)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // `currentState` is null until Android reports the first state, so the
      // ref cannot be assumed to hold a string.
      if (
        /inactive|background/.test(String(appState.current)) &&
        nextAppState === 'active'
      ) {
        void syncPermissionChange(checkPermissions, hasPermission, pushEnabled);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermissions, hasPermission, pushEnabled]);
};

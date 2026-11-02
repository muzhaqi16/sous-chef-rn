import { Linking, Platform } from 'react-native';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { registerDeviceInBackground } from '#/services/device/deviceRegistration';
import { logger } from '#/utils/environment';
import type { NotificationSettings } from '#features/notifications/hooks/useNotificationSettings';
import { useNotificationPermissions } from './useNotificationPermissions';

const openSystemSettings = () => {
  const opening =
    Platform.OS === 'ios'
      ? Linking.openURL('app-settings:')
      : Linking.openSettings();
  void opening.catch(error =>
    logger.warn('Opening the system settings failed', error),
  );
};

/**
 * Turns push on: the OS prompt, then the preference (with anything the caller
 * turns on beside it) in one local-first write, then the device's push token
 * to the server. A refused prompt offers the system settings instead.
 */
export function useTurnOnPush(
  writeSettings: (updates: Partial<NotificationSettings>) => Promise<boolean>,
) {
  const { hasPermission, requestPermissions, checkPermissions } =
    useNotificationPermissions();

  /** Resolves true once push is on; every refusal has been shown. */
  const turnOnPush = async (
    alongside: Partial<NotificationSettings> = {},
  ): Promise<boolean> => {
    const granted = await requestPermissions();
    if (!granted) {
      alertService.alert(
        t('notifications.permissionRequiredTitle'),
        t('notifications.permissionRequiredMessage'),
        [
          { text: t('labels.cancel'), style: 'cancel' },
          { text: t('labels.openSettings'), onPress: openSystemSettings },
        ],
      );
      return false;
    }

    const saved = await writeSettings({ ...alongside, pushEnabled: true });
    if (!saved) {
      alertService.alert(t('labels.error'), t('notifications.updateFailed'));
      return false;
    }

    // The login flow never prompts, so this is where a grant first lands:
    // re-register to deliver the push token.
    registerDeviceInBackground();
    return true;
  };

  return { hasPermission, checkPermissions, turnOnPush };
}

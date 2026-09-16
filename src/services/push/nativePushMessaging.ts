/**
 * Native FCM message receiving (Android): draws messages into the tray via
 * Notifee and routes taps. This is the only delivery path that works while the
 * JS process is asleep or killed — the in-app WebSocket feed needs a live,
 * foregrounded app. Degrades to a no-op when the native module is missing.
 */

import { Platform } from 'react-native';
// react-native-firebase v25 JSDoc-marks its messaging API deprecated with no
// non-deprecated equivalent in this version, so the lint warnings are benign.
// See invertase/react-native-firebase#6283.
import {
  getMessaging,
  setBackgroundMessageHandler,
  onNotificationOpenedApp,
  getInitialNotification,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { showLocalNotification } from '#/services/notifications/localNotificationHelper';
import { routeNotificationTap } from './pushNotificationRouting';

/**
 * Data-only messages (no `notification` block) are never auto-displayed, so
 * Notifee draws them. One WITH a block is drawn by the OS — redrawing it would
 * duplicate the tray entry.
 */
const stringEntries = (
  data: FirebaseMessagingTypes.RemoteMessage['data'],
): Record<string, string> => {
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === 'string') entries[key] = value;
  }
  return entries;
};

const toDisplayableNotification = (
  message: FirebaseMessagingTypes.RemoteMessage,
): {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
} | null => {
  if (message.notification) return null;

  // FCM delivers data values as strings; Notifee accepts nothing else.
  const data = stringEntries(message.data);
  // A server title or body marks the message as meant to be seen, but its text
  // is English in every locale, so the tray shows local copy instead.
  if (!data.title && !data.body) return null;

  return {
    id: firstNonBlank(data.notificationId, message.messageId),
    title: t('pushNotification.title'),
    body: t('pushNotification.body'),
    data,
  };
};

/**
 * MUST be called from index.js, synchronously and outside the React tree, so the
 * headless task that wakes the app can invoke it.
 */
export const registerFcmBackgroundHandler = (): void => {
  if (Platform.OS !== 'android') return;
  try {
    setBackgroundMessageHandler(getMessaging(), async message => {
      const displayable = toDisplayableNotification(message);
      if (displayable) {
        await showLocalNotification(displayable);
      }
    });
  } catch (error) {
    logger.error('FCM background handler registration failed:', error);
  }
};

/**
 * Taps on OS-auto-displayed notifications only: `onNotificationOpenedApp` for a
 * background tap, `getInitialNotification` for a cold launch. Taps on our own
 * Notifee-drawn data-only messages arrive via `setupNotificationHandlers`.
 */
export const registerFcmTapHandlers = (): (() => void) => {
  if (Platform.OS !== 'android') return () => {};
  try {
    const messaging = getMessaging();

    const unsubscribe = onNotificationOpenedApp(messaging, message => {
      routeNotificationTap(message.data);
    });

    getInitialNotification(messaging)
      .then(message => {
        if (message) routeNotificationTap(message.data);
      })
      .catch(error => {
        logger.error('FCM getInitialNotification failed:', error);
      });

    return unsubscribe;
  } catch (error) {
    logger.error('FCM tap handler registration failed:', error);
    return () => {};
  }
};

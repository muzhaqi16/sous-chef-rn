/**
 * Native FCM message receiving (Android).
 *
 * Bridges incoming Firebase Cloud Messaging messages to the tray via the shared
 * Notifee helper, and routes taps to the matching screen. This is the delivery
 * path that works when the JS process is asleep or killed — the in-app
 * WebSocket feed only fires while the app is alive and foregrounded.
 *
 * Every entry point is Android-guarded and defensive: if the native module is
 * missing from the running binary (e.g. before a native rebuild, or on iOS
 * before its APNs setup), it degrades to a no-op instead of crashing.
 */

import { Platform } from 'react-native';
// NOTE: react-native-firebase v25 JSDoc-marks its messaging API as deprecated
// ahead of a future redesign, but there is no non-deprecated equivalent in this
// version — the `no-deprecated` lint warnings here are unavoidable and benign.
// See invertase/react-native-firebase#6283.
import {
  getMessaging,
  setBackgroundMessageHandler,
  onNotificationOpenedApp,
  getInitialNotification,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { logger } from '#/utils/environment';
import { showLocalNotification } from '#/utils/notifications/localNotificationHelper';
import { routeNotificationTap } from './pushNotificationRouting';

/**
 * A message we should surface ourselves. Data-only messages (no `notification`
 * block) are never auto-displayed by the OS, so we draw them via Notifee.
 * Messages that carry a `notification` block are auto-displayed by the OS when
 * the app is backgrounded — re-drawing them would duplicate the tray entry, so
 * we skip display and let the OS own it.
 */
const toDisplayableNotification = (
  message: FirebaseMessagingTypes.RemoteMessage,
): {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
} | null => {
  if (message.notification) return null;

  const data = (message.data ?? {}) as Record<string, string>;
  const title = typeof data.title === 'string' ? data.title : '';
  const body = typeof data.body === 'string' ? data.body : '';
  if (!title && !body) return null;

  return {
    id: data.notificationId || message.messageId,
    title,
    body,
    data,
  };
};

/**
 * Registers the background/quit-state FCM handler. MUST be called at the JS
 * entry point (index.js), synchronously and outside the React tree, so the
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
 * Registers tap handlers for OS-auto-displayed FCM notifications (those with a
 * `notification` block): `onNotificationOpenedApp` covers a tap that brings the
 * app from background, `getInitialNotification` covers a tap that cold-launches
 * it from a killed state. Taps on our own Notifee-drawn (data-only) messages
 * arrive through Notifee's event handlers instead — see setupNotificationHandlers.
 * Returns an unsubscribe for the background-tap listener.
 */
export const registerFcmTapHandlers = (): (() => void) => {
  if (Platform.OS !== 'android') return () => {};
  try {
    const messaging = getMessaging();

    const unsubscribe = onNotificationOpenedApp(messaging, message => {
      routeNotificationTap(message?.data);
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

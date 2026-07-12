/**
 * Native APNs message receiving (iOS).
 *
 * Routes taps on remote pushes — which iOS auto-displays when backgrounded or
 * killed — to the matching screen through the shared, platform-agnostic router,
 * and completes the background-fetch handler for silent (`content-available`)
 * pushes. The token/registration half lives in `iosPushProvider`; Android uses
 * `nativePushMessaging` (FCM) instead.
 *
 * iOS-guarded and defensive: on the wrong platform, or if the native module is
 * missing from the running binary, it degrades to a no-op instead of crashing.
 */

import { Platform } from 'react-native';
import PushNotificationIOS, {
  type PushNotification,
} from '@react-native-community/push-notification-ios';
import { logger } from '#/utils/environment';
import { routeNotificationTap } from './pushNotificationRouting';

/**
 * Registers tap handlers for APNs notifications. A tap is delivered through the
 * `localNotification` event (fed by the AppDelegate's `didReceiveNotificationResponse`
 * forward); `getInitialNotification` covers a tap that cold-launches the app
 * from a killed state. The tapped notification's `getData()` returns the APNs
 * `userInfo`, which carries the `category` routing key. Returns an unsubscribe.
 */
export const registerIosPushTapHandlers = (): (() => void) => {
  if (Platform.OS !== 'ios') return () => {};
  try {
    const handleTap = (notification: PushNotification) => {
      routeNotificationTap(notification.getData());
    };
    PushNotificationIOS.addEventListener('localNotification', handleTap);

    // Silent/background pushes (content-available) arrive on the `notification`
    // event with a stored completion handler (the AppDelegate forwards
    // didReceiveRemoteNotification:fetchCompletionHandler:). We don't draw them
    // — the OS displays alert pushes and the in-app feed owns the foreground —
    // but we MUST call finish() so iOS doesn't throttle background delivery and
    // the native completion callback isn't leaked.
    const handleBackgroundNotification = (notification: PushNotification) => {
      notification.finish(PushNotificationIOS.FetchResult.NoData);
    };
    PushNotificationIOS.addEventListener(
      'notification',
      handleBackgroundNotification,
    );

    PushNotificationIOS.getInitialNotification()
      .then(notification => {
        if (notification) routeNotificationTap(notification.getData());
      })
      .catch(error => {
        logger.error('APNs getInitialNotification failed:', error);
      });

    return () => {
      PushNotificationIOS.removeEventListener('localNotification');
      PushNotificationIOS.removeEventListener('notification');
    };
  } catch (error) {
    logger.error('APNs tap handler registration failed:', error);
    return () => {};
  }
};

/**
 * Native APNs message receiving (iOS): routes pushes taps to the matching screen
 * and completes the background-fetch handler for silent pushes. The token half
 * is `iosPushProvider`; Android uses `nativePushMessaging` (FCM). Degrades to a
 * no-op off-platform or when the native module is missing from the binary.
 */

import { NativeModules, Platform } from 'react-native';
import PushNotificationIOS, {
  type PushNotification,
} from '@react-native-community/push-notification-ios';
import { logger } from '#/utils/environment';
import { routeNotificationTap } from './pushNotificationRouting';

// One-shot native cache of the tap that launched a killed app (see
// PushNotificationForwarder). Absent on Android and in older binaries.
const getInitialTapModule = () =>
  (
    NativeModules as {
      InitialNotificationTap?: {
        consume: () => Promise<Record<string, unknown> | null>;
      };
    }
  ).InitialNotificationTap;

/**
 * A tap arrives on the `localNotification` event (the AppDelegate forwards
 * `didReceiveNotificationResponse`); `getData()` returns the APNs `userInfo`,
 * which carries the `category` routing key. Returns an unsubscribe.
 */
export const registerIosPushTapHandlers = (): (() => void) => {
  if (Platform.OS !== 'ios') return () => {};
  try {
    const handleTap = (notification: PushNotification) => {
      routeNotificationTap(notification.getData());
    };
    PushNotificationIOS.addEventListener('localNotification', handleTap);

    // Silent (content-available) pushes arrive on `notification` with a stored
    // completion handler. Nothing is drawn, but finish() MUST be called or iOS
    // throttles background delivery and the native callback leaks.
    const handleBackgroundNotification = (notification: PushNotification) => {
      notification.finish(PushNotificationIOS.FetchResult.NoData);
    };
    PushNotificationIOS.addEventListener(
      'notification',
      handleBackgroundNotification,
    );

    // Killed-app tap: the library's NSNotification fires before any JS listener
    // exists, and getInitialNotification's launchOptions are empty for
    // tap-launches once a UNUserNotificationCenterDelegate is set — so read the
    // natively cached tap, keeping getInitialNotification as the fallback for
    // binaries without the module. Safe pre-nav-ready: NavigationService parks
    // the route and flushes it on the container's onReady.
    const routeInitialTap = async () => {
      try {
        const initialTapModule = getInitialTapModule();
        if (initialTapModule) {
          const userInfo = await initialTapModule.consume();
          if (userInfo) routeNotificationTap(userInfo);
          return;
        }
        const notification = await PushNotificationIOS.getInitialNotification();
        if (notification) routeNotificationTap(notification.getData());
      } catch (error) {
        logger.error('APNs initial tap retrieval failed:', error);
      }
    };
    void routeInitialTap();

    return () => {
      PushNotificationIOS.removeEventListener('localNotification');
      PushNotificationIOS.removeEventListener('notification');
    };
  } catch (error) {
    logger.error('APNs tap handler registration failed:', error);
    return () => {};
  }
};

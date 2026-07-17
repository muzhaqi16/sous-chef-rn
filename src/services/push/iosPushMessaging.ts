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

import { NativeModules, Platform } from 'react-native';
import PushNotificationIOS, {
  type PushNotification,
} from '@react-native-community/push-notification-ios';
import { logger } from '#/utils/environment';
import { routeNotificationTap } from './pushNotificationRouting';

// One-shot native cache of the tap that launched the killed app (see
// PushNotificationForwarder). Optional: absent on Android and in binaries
// built before the module existed.
const getInitialTapModule = () =>
  (
    NativeModules as {
      InitialNotificationTap?: {
        consume: () => Promise<Record<string, unknown> | null>;
      };
    }
  ).InitialNotificationTap;

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

    // Killed-app tap: the library's tap NSNotification fires before any JS
    // listener exists and getInitialNotification's launchOptions are not
    // populated for tap-launches once a UNUserNotificationCenterDelegate is
    // set — so pull the natively cached launching tap instead. Routing is
    // safe even pre-nav-ready: NavigationService parks it in the pending
    // slot and flushes on the container's onReady. getInitialNotification
    // stays as the fallback for binaries without the module, gated behind
    // the consume result so one tap can never route twice.
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

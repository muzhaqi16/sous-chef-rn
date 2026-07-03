import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { errorService } from '#/services/errorService';
import { routeNotificationTap } from '#/services/push/pushNotificationRouting';

interface LocalNotificationParams {
  id?: string;
  title: string;
  body: string;
  // Carried through to the tray entry so a tap can be routed to the right
  // screen. FCM/Notifee payloads are flat string maps.
  data?: Record<string, string>;
}

const BIGTEXT_THRESHOLD = 50;

// PERFORMANCE: Cache channel creation result to avoid repeated synchronous native calls
let defaultChannelCreated = false;

const ensureDefaultChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android' || defaultChannelCreated) {
    return;
  }

  await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    importance: AndroidImportance.HIGH,
    vibration: true,
    lights: true,
  });

  defaultChannelCreated = true;
};

export const showLocalNotification = async ({
  id,
  title,
  body,
  data,
}: LocalNotificationParams) => {
  try {
    await ensureDefaultChannel();

    await notifee.displayNotification({
      id,
      title,
      body,
      data,
      ios: {
        sound: 'default',
        categoryId: 'default',
      },
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        style:
          body.length > BIGTEXT_THRESHOLD
            ? {
                type: AndroidStyle.BIGTEXT,
                text: body,
              }
            : undefined,
        smallIcon: 'ic_notification',
      },
    });
  } catch (error) {
    errorService.reportError(error, { operation: 'showLocalNotification' });

    // If notification fails on Android, try a basic fallback without styling
    if (Platform.OS === 'android') {
      try {
        await notifee.displayNotification({
          id: `${id}_fallback`,
          title,
          body,
          android: {
            channelId: 'default',
            importance: AndroidImportance.DEFAULT,
            smallIcon: 'ic_notification',
          },
        });
      } catch (fallbackError) {
        errorService.reportError(fallbackError, {
          operation: 'showFallbackNotification',
        });
      }
    }
  }
};

/**
 * Registers Notifee foreground and background event handlers.
 * Must be called at app entry (index.js) before AppRegistry.registerComponent.
 *
 * A PRESS event on a notification we drew (data-only FCM / local) routes to the
 * matching screen: onForegroundEvent covers a tap while the app is open,
 * onBackgroundEvent covers a tap that brings it from background or cold-launches
 * it from a killed state.
 */
export const setupNotificationHandlers = () => {
  const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      routeNotificationTap(detail.notification?.data);
    }
  });

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      routeNotificationTap(detail.notification?.data);
    }
  });

  return unsubscribe;
};

import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { errorService } from '#/services/errorService';

interface LocalNotificationParams {
  id: string;
  title: string;
  body: string;
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
}: LocalNotificationParams) => {
  try {
    await ensureDefaultChannel();

    await notifee.displayNotification({
      id,
      title,
      body,
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
 */
export const setupNotificationHandlers = () => {
  const unsubscribe = notifee.onForegroundEvent(({ type }) => {
    if (type === EventType.DISMISSED) {
      // No-op: dismissals don't require action
    }
  });

  notifee.onBackgroundEvent(async () => {
    // Required by Notifee — must register a handler even if it's a no-op
  });

  return unsubscribe;
};

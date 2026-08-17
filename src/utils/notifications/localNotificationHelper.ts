import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { errorService } from '#/services/errorService';
import { routeNotificationTap } from '#/services/push/pushNotificationRouting';
import { getI18n } from '#/i18n/config';
import { t } from '#/i18n';

interface LocalNotificationParams {
  id?: string;
  title: string;
  body: string;
  // Carried through to the tray entry so a tap can be routed to the right
  // screen. FCM/Notifee payloads are flat string maps.
  data?: Record<string, string>;
}

const BIGTEXT_THRESHOLD = 50;

/**
 * Language the channel was last created under, or null if it has not been
 * created this session.
 *
 * PERFORMANCE: creating the channel is a synchronous native call, so it must not
 * run per notification — but the cache is keyed by language rather than a bare
 * boolean, because the channel `name` is **user-visible copy**. Android lists it
 * under Settings › Apps › Sous Chef › Notifications and shows it when a
 * notification is long-pressed, so it has to follow the active language.
 *
 * Re-calling `createChannel` with an existing id is the documented way to update
 * a channel: name and description are applied, and everything else is left as
 * the user configured it (importance in particular cannot be raised again, which
 * is why the values below are unchanged between calls).
 */
let channelLanguage: string | null = null;

const ensureDefaultChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }

  const i18n = getI18n();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  if (channelLanguage === language) {
    return;
  }

  await notifee.createChannel({
    id: 'default',
    name: t('notifications.channelGeneral'),
    importance: AndroidImportance.HIGH,
    vibration: true,
    lights: true,
  });

  channelLanguage = language;
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
 *
 * Also keeps the Android channel name on the active language. `index.js` imports
 * `src/i18n/config` before calling this, so the instance is initialized here.
 */
export const setupNotificationHandlers = () => {
  const unsubscribeForeground = notifee.onForegroundEvent(
    ({ type, detail }) => {
      if (type === EventType.PRESS) {
        routeNotificationTap(detail.notification?.data);
      }
    },
  );

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      routeNotificationTap(detail.notification?.data);
    }
  });

  // Without this the renamed channel would only reach Android settings the next
  // time a notification happened to be shown — the user switches language, opens
  // notification settings to check something, and reads the old language there.
  const i18n = getI18n();
  const refreshChannelName = () => {
    void ensureDefaultChannel();
  };
  i18n.on('languageChanged', refreshChannelName);

  return () => {
    unsubscribeForeground();
    i18n.off('languageChanged', refreshChannelName);
  };
};

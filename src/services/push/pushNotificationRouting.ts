/**
 * Deep-link routing for a tapped push, platform-agnostic. Uses the imperative
 * NavigationService because a background/killed launch has no React tree to read
 * a navigation hook from. Where it leads is `notificationDestination`'s, which
 * the notification list asks too.
 */

import NavigationService from '#/services/NavigationService';
import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { notificationDestination } from './notificationDestination';

// FCM/Notifee payloads are flat string maps. Routing keys off `category` and
// `notificationId`; the other fields ride along for dedup and correlation.
export interface NotificationTapData {
  category?: string;
  notificationId?: string;
}

const readTapData = (
  data: NotificationTapData | Record<string, unknown> | null | undefined,
): NotificationTapData => {
  if (!data) return {};
  const category =
    typeof data.category === 'string' ? data.category : undefined;
  const notificationId =
    typeof data.notificationId === 'string' && data.notificationId !== ''
      ? data.notificationId
      : undefined;
  return { category, notificationId };
};

export const routeNotificationTap = (
  data: NotificationTapData | Record<string, unknown> | null | undefined,
): void => {
  const { category, notificationId } = readTapData(data);
  // A push naming its row marks that row read once the signed-in app is there;
  // a summary push names no row and leaves its rows as they are.
  if (category && notificationId) {
    useNotificationStore.getState().noteOpenedFromPush(notificationId);
  }

  const destination = notificationDestination(
    category,
    category ? notificationId : undefined,
  );
  switch (destination.kind) {
    case 'feature':
      NavigationService.navigate('Home', {
        screen: destination.tab,
        params: { screen: destination.screen },
      });
      return;
    case 'detail':
      NavigationService.navigate('NotificationDetail', { id: destination.id });
      return;
    case 'feed':
    default:
      NavigationService.navigate('Notifications');
  }
};

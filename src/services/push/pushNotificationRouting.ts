/**
 * Deep-link routing for a tapped push, platform-agnostic. Uses the imperative
 * NavigationService because a background/killed launch has no React tree to read
 * a navigation hook from. The category → screen map mirrors
 * `handleNotificationPress` in NotificationListScreen.
 */

import NavigationService from '#/services/NavigationService';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';

// FCM/Notifee payloads are flat string maps. Routing keys off `category` and
// the PRESENCE of `notificationId`; the other fields ride along for dedup and
// correlation, so aren't modeled here.
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
    typeof data.notificationId === 'string' ? data.notificationId : undefined;
  return { category, notificationId };
};

export const routeNotificationTap = (
  data: NotificationTapData | Record<string, unknown> | null | undefined,
): void => {
  const { category, notificationId } = readTapData(data);

  // A push the server coalesced over a quiet-hours window stands for several
  // notifications and carries no `notificationId`, while `sourceId` survives
  // and names only the first — so routing it anywhere specific opens one item
  // out of many. The feed is the only honest destination.
  if (!notificationId) {
    NavigationService.navigate('Notifications');
    return;
  }

  switch (category?.toUpperCase()) {
    case NotificationCategory.Shopping:
      NavigationService.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'ShoppingListMain' },
      });
      return;
    case NotificationCategory.Pantry:
      NavigationService.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryMain' },
      });
      return;
    case NotificationCategory.Recipe:
      NavigationService.navigate('Home', {
        screen: 'Recipe',
        params: { screen: 'RecipeMain' },
      });
      return;
    default:
      // Everything else (home/system or an unknown category) opens the feed,
      // where the user can read the item and take its specific action.
      NavigationService.navigate('Notifications');
  }
};

/**
 * Deep-link routing for a tapped push, platform-agnostic. Uses the imperative
 * NavigationService because a background/killed launch has no React tree to read
 * a navigation hook from. The category → screen map mirrors
 * `handleNotificationPress` in NotificationListScreen.
 */

import NavigationService from '#/services/NavigationService';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';

// FCM/Notifee payloads are flat string maps. Routing keys off `category` alone;
// the other fields ride along for dedup and correlation, so aren't modeled here.
export interface NotificationTapData {
  category?: string;
}

const readTapData = (
  data: NotificationTapData | Record<string, unknown> | null | undefined,
): NotificationTapData => {
  if (!data) return {};
  const category =
    typeof data.category === 'string' ? data.category : undefined;
  return { category };
};

export const routeNotificationTap = (
  data: NotificationTapData | Record<string, unknown> | null | undefined,
): void => {
  const { category } = readTapData(data);

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

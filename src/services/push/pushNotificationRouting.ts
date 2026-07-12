/**
 * Deep-link routing for a tapped push notification.
 *
 * Platform-agnostic: given the `data` payload carried on a notification (the
 * same string map whether it arrives via Notifee or FCM), it navigates to the
 * matching in-app destination through the imperative NavigationService, so it
 * works from a background/killed launch when there is no React tree to read a
 * navigation hook from. The category → screen mapping mirrors the in-app
 * `handleNotificationPress` routing in NotificationListScreen.
 */

import NavigationService from '#/services/NavigationService';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';

// FCM/Notifee data payloads are flat string maps; values may be absent.
export interface NotificationTapData {
  category?: string;
  sourceType?: string;
  actionUrl?: string;
  notificationId?: string;
}

// The push `data` payload may carry the high-level `category` or only the
// entity-level `sourceType`, depending on what the server includes. When
// `category` is absent, derive it from `sourceType` so the tap still deep-links.
// sourceType values follow the API's notification-system conventions.
const CATEGORY_BY_SOURCE_TYPE: Record<string, string> = {
  PantryItem: NotificationCategory.Pantry,
  PantryItemBatch: NotificationCategory.Pantry,
  ShoppingList: NotificationCategory.Shopping,
  SHOPPING_LIST_COLLABORATOR: NotificationCategory.Shopping,
};

const readTapData = (
  data: NotificationTapData | Record<string, unknown> | null | undefined,
): NotificationTapData => {
  if (!data) return {};
  const category =
    typeof data.category === 'string' ? data.category : undefined;
  const sourceType =
    typeof data.sourceType === 'string' ? data.sourceType : undefined;
  return {
    category:
      category ??
      (sourceType ? CATEGORY_BY_SOURCE_TYPE[sourceType] : undefined),
  };
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
    default:
      // Everything else (recipe/home/system or an unknown category) opens the
      // feed, where the user can read the item and take its specific action.
      NavigationService.navigate('Notifications');
  }
};

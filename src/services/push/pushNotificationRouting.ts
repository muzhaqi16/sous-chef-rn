/**
 * Deep-link routing for a tapped push notification.
 *
 * Platform-agnostic: given the `data` payload carried on a notification (the
 * same string map whether it arrives via Notifee or FCM), it navigates to the
 * matching in-app destination through the imperative NavigationService, so it
 * works from a background/killed launch when there is no React tree to read a
 * navigation hook from.
 *
 * Routing precedence: a specific `actionUrl` deep link wins over the coarse
 * `category → tab` mapping (which mirrors the in-app `handleNotificationPress`
 * routing in NotificationListScreen), which in turn falls back to the feed.
 */

import { Linking } from 'react-native';
import NavigationService from '#/services/NavigationService';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { appConfig } from '#/config/appConfig';

// App-owned custom scheme (e.g. `souschef://`). Only links on this scheme are
// dispatched — an external `https://` URL is deliberately NOT opened so a
// notification can never bounce the user out to a browser.
const DEEP_LINK_SCHEME_PREFIX = `${appConfig.identity.deepLink.scheme}://`;

// FCM/Notifee data payloads are flat string maps; values may be absent.
export interface NotificationTapData {
  category?: string;
  actionUrl?: string;
  notificationId?: string;
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const readTapData = (
  data: NotificationTapData | Record<string, unknown> | null | undefined,
): NotificationTapData => {
  if (!data) return {};
  return {
    category: asString(data.category),
    actionUrl: asString(data.actionUrl),
    notificationId: asString(data.notificationId),
  };
};

/**
 * Hand an app-scheme deep link (e.g. `souschef://join/abc`) to the OS so React
 * Navigation's linking config routes it — the same path an external tap on the
 * link takes. Returns `true` when the URL was an internal deep link we
 * dispatched (so the caller skips category routing). A failed dispatch falls
 * back to the feed rather than a dead tap.
 */
const openInternalDeepLink = (url: string | undefined): boolean => {
  if (!url || !url.startsWith(DEEP_LINK_SCHEME_PREFIX)) return false;
  void Linking.openURL(url).catch(() => {
    NavigationService.navigate('Notifications');
  });
  return true;
};

export const routeNotificationTap = (
  data: NotificationTapData | Record<string, unknown> | null | undefined,
): void => {
  const { category, actionUrl } = readTapData(data);

  // A specific deep link wins over the coarse category routing below.
  if (openInternalDeepLink(actionUrl)) return;

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

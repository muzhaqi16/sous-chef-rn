/**
 * Keeps the OS app-icon badge in sync with the notification store's unread
 * count.
 *
 * The server sets the badge on each alert push (`aps.badge` on iOS,
 * `notification_count` on Android), but it can only update the badge *on
 * delivery* — it can't clear it when the user reads notifications in-app. This
 * subscription closes that gap: whenever `unreadCount` changes (including to 0
 * on read or logout), the OS badge is set to match.
 *
 * Notifee's `setBadgeCount` is cross-platform — the iOS app-icon badge and,
 * best-effort, Android launchers that support badging (matching the server's
 * Android contract). Call once at app entry (`index.js`); returns an
 * unsubscribe.
 */

import notifee from '@notifee/react-native';
import { useStore } from '#store';
import { logger } from '#/utils/environment';

const applyBadgeCount = (count: number): void => {
  notifee.setBadgeCount(Math.max(0, count)).catch(error => {
    logger.error('setBadgeCount failed:', error);
  });
};

export const setupBadgeSync = (): (() => void) =>
  useStore.subscribe(state => state.unreadCount, applyBadgeCount, {
    fireImmediately: true,
  });

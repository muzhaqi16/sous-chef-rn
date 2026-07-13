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

export const setupBadgeSync = (): (() => void) => {
  // Never apply a badge before hydration: the pre-hydration `unreadCount` is 0,
  // so a `fireImmediately` apply at every JS start (including headless launches)
  // would stomp a server-set badge to 0. Gate the count sync on `isHydrated`,
  // and apply the real count once when hydration completes.
  const syncIfHydrated = (count: number): void => {
    if (useStore.getState().isHydrated) applyBadgeCount(count);
  };

  // Warm re-subscribe (already hydrated) applies immediately via fireImmediately;
  // a cold start no-ops here until hydration.
  const unsubscribeCount = useStore.subscribe(
    state => state.unreadCount,
    syncIfHydrated,
    { fireImmediately: true },
  );

  // Cold start: apply the hydrated count once the flag flips, covering the case
  // where `unreadCount` doesn't change during hydration (e.g. persisted 0).
  const unsubscribeHydration = useStore.subscribe(
    state => state.isHydrated,
    hydrated => {
      if (hydrated) applyBadgeCount(useStore.getState().unreadCount);
    },
  );

  return () => {
    unsubscribeCount();
    unsubscribeHydration();
  };
};

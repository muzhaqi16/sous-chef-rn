/**
 * Keeps the OS app-icon badge in sync with the server's unread count.
 *
 * The server sets the badge on each alert push (`aps.badge` on iOS,
 * `notification_count` on Android), but only *on delivery* — it cannot clear it
 * when the user reads notifications in-app. This closes that gap: whenever the
 * cached `User.unreadNotificationCount` changes (including to 0 on read or
 * logout), the OS badge is set to match.
 *
 * It watches the Apollo cache, which is where that count lives. It used to
 * watch a Zustand mirror of it, and needed an `isHydrated` gate so a
 * pre-hydration `0` could not stomp a server-set badge at every JS start.
 * That gate is gone and not replaced: "the count has not loaded yet" is
 * directly observable here as a cache read with no data BEFORE any count has
 * been applied, so there is no window in which a default value looks like a
 * real one. Once a count has been applied, the same empty read means the store
 * was cleared — sign-out — and the badge is zeroed.
 *
 * Notifee's `setBadgeCount` is cross-platform — the iOS app-icon badge and,
 * best-effort, Android launchers that support badging. Call once at app entry
 * (`index.js`); returns an unsubscribe.
 */

import notifee from '@notifee/react-native';
import { client } from '#/apollo/client';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { logger } from '#/utils/environment';

const applyBadgeCount = (count: number): void => {
  notifee.setBadgeCount(Math.max(0, count)).catch(error => {
    logger.error('setBadgeCount failed:', error);
  });
};

export const setupBadgeSync = (): (() => void) => {
  let lastApplied: number | null = null;

  const readAndApply = (): void => {
    // `cache-only`, and a miss reads as null rather than 0 — that distinction
    // is the whole reason the hydration gate is unnecessary.
    const data = client.cache.readQuery({
      query: GetUnreadNotificationsDocument,
    }) as { me?: { unreadNotificationCount?: number } | null } | null;

    const count = data?.me?.unreadNotificationCount;
    // A miss before anything has been applied is "not loaded yet" — the case
    // the hydration gate used to cover. A miss AFTER a count was applied is
    // `clearStore()` on sign-out, and the badge has to come off the icon.
    const next =
      typeof count === 'number' ? count : lastApplied === null ? null : 0;
    if (next === null || next === lastApplied) return;

    lastApplied = next;
    applyBadgeCount(next);
  };

  const watcher = client.cache.watch({
    query: GetUnreadNotificationsDocument,
    optimistic: false,
    // Fires on the persisted-cache restore too, which is what covers cold start.
    callback: () => readAndApply(),
  });

  readAndApply();

  return () => {
    watcher();
  };
};

/**
 * Keeps the OS app-icon badge in sync with `User.unreadNotificationCount`: the
 * server sets it on push delivery but cannot clear it when the user reads
 * in-app. Watching the Apollo CACHE, not a Zustand mirror, removes the need for
 * a hydration gate — a miss reads null, distinguishable from a real 0.
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
    // A miss reads as null rather than 0; that distinction is what removes the
    // need for a hydration gate.
    const data = client.cache.readQuery({
      query: GetUnreadNotificationsDocument,
    }) as { me?: { unreadNotificationCount?: number } | null } | null;

    const count = data?.me?.unreadNotificationCount;
    // A miss before anything is applied means "not loaded yet"; a miss AFTER is
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

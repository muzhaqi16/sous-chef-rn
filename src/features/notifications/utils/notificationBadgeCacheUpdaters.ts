import type { ApolloCache } from '@apollo/client';

/**
 * Keeps the server-authoritative badge aggregates on the cached `User` entity
 * (`unreadNotificationCount`, `hasUrgentNotifications`) in step with the
 * notification state mutations. Those mutations select only
 * `notification { id status }`, so without these updaters a mark-read writes
 * `Notification.status` — re-broadcasting the watched notification queries —
 * while the cached count stays at its fetch-time value, and the badge seed in
 * `useNotificationHistory` / `useNotificationsOnLaunch` re-applies the stale
 * number over the local decrement.
 *
 * If the API ever adds the updated count to these mutation payloads, response
 * write-through should replace these manual adjustments.
 */

interface BadgeAggregates {
  unreadNotificationCount: number;
  hasUrgentNotifications: boolean;
}

/**
 * Shift `User.unreadNotificationCount` by `delta`, clamped at zero. When the
 * count lands at zero there is nothing urgent left outstanding, so
 * `hasUrgentNotifications` is cleared too. No-ops (without throwing) for a
 * falsy user id, an unidentifiable entity, a zero delta, or a cache entity
 * that never fetched the field (cache.modify skips absent fields).
 */
export function adjustUnreadNotificationCount(
  cache: ApolloCache,
  userId: string | null | undefined,
  delta: number,
): void {
  if (!userId || delta === 0) return;
  const cacheId = cache.identify({ __typename: 'User', id: userId });
  if (!cacheId) return;
  // The count modifier runs before the urgent one (field-object key order), so
  // the urgent flag can react to where the count landed.
  let landedAtZero = false;
  cache.modify<BadgeAggregates>({
    id: cacheId,
    fields: {
      unreadNotificationCount: existing => {
        const current = typeof existing === 'number' ? existing : 0;
        const next = Math.max(0, current + delta);
        landedAtZero = next === 0;
        return next;
      },
      hasUrgentNotifications: existing => (landedAtZero ? false : existing),
    },
  });
}

/**
 * Zero out the badge aggregates — the mark-all-read path. Same no-op safety
 * as {@link adjustUnreadNotificationCount}.
 */
export function clearUnreadNotificationCount(
  cache: ApolloCache,
  userId: string | null | undefined,
): void {
  if (!userId) return;
  const cacheId = cache.identify({ __typename: 'User', id: userId });
  if (!cacheId) return;
  cache.modify<BadgeAggregates>({
    id: cacheId,
    fields: {
      unreadNotificationCount: () => 0,
      hasUrgentNotifications: () => false,
    },
  });
}

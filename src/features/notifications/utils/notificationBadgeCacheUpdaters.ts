import type { ApolloCache } from '@apollo/client';

/**
 * Keeps the badge aggregates on the cached `User` in step with the notification
 * mutations, which select only `notification { id status }`. Without these the
 * count stays at its fetch-time value and the badge seed re-applies that stale
 * number over the local decrement.
 */

interface BadgeAggregates {
  unreadNotificationCount: number;
  hasUrgentNotifications: boolean;
}

/**
 * Shifts `unreadNotificationCount` by `delta`, clamped at zero, clearing
 * `hasUrgentNotifications` when it lands there. No-ops without throwing for a
 * falsy user id, a zero delta, or an entity that never fetched the field.
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

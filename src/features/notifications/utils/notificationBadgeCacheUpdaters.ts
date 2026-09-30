import type { ApolloCache } from '@apollo/client';
import type {
  NotificationSummary,
  Query,
} from '#/graphql/generated/schemaTypes';

/**
 * Moves the cached badge (`Query.notificationSummary`) for a write the server
 * has not answered yet, so a queued write shows at once. A response states the
 * summary and normalization settles it, so none of these runs after one.
 */

type Badge = Pick<NotificationSummary, 'unreadCount' | 'hasUrgent'>;

/**
 * The cache id `ROOT_QUERY.notificationSummary` points at, or undefined before
 * a query has loaded the badge. `cache.modify` reads here: returning `existing`
 * unchanged writes nothing.
 */
function cachedSummaryId(cache: ApolloCache): string | undefined {
  let id: string | undefined;
  cache.modify<Pick<Query, 'notificationSummary'>>({
    id: 'ROOT_QUERY',
    fields: {
      notificationSummary: (existing, { isReference }) => {
        if (isReference(existing)) id = existing.__ref;
        return existing;
      },
    },
  });
  return id;
}

/**
 * Shifts `unreadCount` by `delta`, clamped at zero, clearing `hasUrgent` when
 * it lands there. No-ops without throwing for a zero delta or an uncached
 * badge.
 */
export function adjustUnreadNotificationCount(
  cache: ApolloCache,
  delta: number,
): void {
  if (delta === 0) return;
  const cacheId = cachedSummaryId(cache);
  if (!cacheId) return;
  // The count modifier runs before the urgent one (field-object key order), so
  // the urgent flag can react to where the count landed.
  let landedAtZero = false;
  cache.modify<Badge>({
    id: cacheId,
    fields: {
      unreadCount: existing => {
        const current = typeof existing === 'number' ? existing : 0;
        const next = Math.max(0, current + delta);
        landedAtZero = next === 0;
        return next;
      },
      hasUrgent: existing => (landedAtZero ? false : existing),
    },
  });
}

/**
 * Zero the badge — the mark-all-read path. Same no-op safety as
 * {@link adjustUnreadNotificationCount}.
 */
export function clearUnreadNotificationCount(cache: ApolloCache): void {
  const cacheId = cachedSummaryId(cache);
  if (!cacheId) return;
  cache.modify<Badge>({
    id: cacheId,
    fields: {
      unreadCount: () => 0,
      hasUrgent: () => false,
    },
  });
}

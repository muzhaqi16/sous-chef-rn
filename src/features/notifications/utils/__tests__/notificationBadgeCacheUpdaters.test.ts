import type { InMemoryCache } from '@apollo/client';
import { seedCache } from '#/test-utils/apolloMockProvider';
import { NotificationSummaryDocument } from '#features/notifications/graphql/notifications.generated';
import {
  adjustUnreadNotificationCount,
  clearUnreadNotificationCount,
} from '../notificationBadgeCacheUpdaters';

/** A cache whose `Query.notificationSummary` is `NotificationSummary:user-1`. */
const seedBadge = (
  unreadCount: number,
  hasUrgent = true,
  others: Parameters<typeof seedCache>[0] = [],
) => {
  const cache = seedCache(others);
  cache.writeQuery({
    query: NotificationSummaryDocument,
    data: {
      __typename: 'Query',
      notificationSummary: {
        __typename: 'NotificationSummary',
        id: 'user-1',
        unreadCount,
        hasUrgent,
      },
    },
  });
  return cache;
};

const readBadge = (cache: InMemoryCache) =>
  cache.readQuery({ query: NotificationSummaryDocument })?.notificationSummary;

describe('adjustUnreadNotificationCount', () => {
  it('shifts the count by the delta', () => {
    const cache = seedBadge(5);
    adjustUnreadNotificationCount(cache, -1);
    expect(readBadge(cache)).toEqual({
      __typename: 'NotificationSummary',
      id: 'user-1',
      unreadCount: 4,
      hasUrgent: true,
    });

    adjustUnreadNotificationCount(cache, 1);
    expect(readBadge(cache)?.unreadCount).toBe(5);
  });

  it('clamps at zero instead of going negative', () => {
    const cache = seedBadge(0);
    adjustUnreadNotificationCount(cache, -1);
    expect(readBadge(cache)?.unreadCount).toBe(0);
  });

  it('clears hasUrgent when the count lands at zero', () => {
    const cache = seedBadge(1);
    adjustUnreadNotificationCount(cache, -1);
    expect(readBadge(cache)).toMatchObject({
      unreadCount: 0,
      hasUrgent: false,
    });
  });

  it('leaves hasUrgent alone while unread remain', () => {
    const cache = seedBadge(3);
    adjustUnreadNotificationCount(cache, -1);
    expect(readBadge(cache)?.hasUrgent).toBe(true);
  });

  it('no-ops for a zero delta', () => {
    const cache = seedBadge(5);
    adjustUnreadNotificationCount(cache, 0);
    expect(readBadge(cache)?.unreadCount).toBe(5);
  });

  // The id is the caller's user id, which the cache knows only through the
  // root field; a summary nothing points at is not the badge.
  it('moves the summary Query.notificationSummary points at, and no other', () => {
    const cache = seedBadge(5, true, [
      {
        __typename: 'NotificationSummary',
        id: 'someone-else',
        unreadCount: 9,
        hasUrgent: true,
      },
    ]);
    adjustUnreadNotificationCount(cache, -1);

    expect(readBadge(cache)?.unreadCount).toBe(4);
    expect(cache.extract()['NotificationSummary:someone-else']).toMatchObject({
      unreadCount: 9,
    });
  });

  it('does not throw when no badge is cached', () => {
    const empty = seedCache([]);
    expect(() => adjustUnreadNotificationCount(empty, -1)).not.toThrow();
    expect(readBadge(empty)).toBeUndefined();
  });
});

describe('clearUnreadNotificationCount', () => {
  it('zeroes the count and clears the urgent flag', () => {
    const cache = seedBadge(7);
    clearUnreadNotificationCount(cache);
    expect(readBadge(cache)).toMatchObject({
      unreadCount: 0,
      hasUrgent: false,
    });
  });

  it('does not throw when no badge is cached', () => {
    const empty = seedCache([]);
    expect(() => clearUnreadNotificationCount(empty)).not.toThrow();
  });
});

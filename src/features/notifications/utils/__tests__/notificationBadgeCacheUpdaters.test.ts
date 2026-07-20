import { gql } from '@apollo/client';
import type { InMemoryCache } from '@apollo/client';
import { seedCache } from '#/test-utils/apolloMockProvider';
import {
  adjustUnreadNotificationCount,
  clearUnreadNotificationCount,
} from '../notificationBadgeCacheUpdaters';

const BADGE_FRAGMENT = gql`
  fragment _TestBadge on User {
    unreadNotificationCount
    hasUrgentNotifications
  }
`;

const seedUser = (
  unreadNotificationCount: number,
  hasUrgentNotifications = true,
) =>
  seedCache([
    {
      __typename: 'User',
      id: 'user-1',
      unreadNotificationCount,
      hasUrgentNotifications,
    },
  ]);

const readBadge = (cache: InMemoryCache) =>
  cache.readFragment<{
    unreadNotificationCount: number;
    hasUrgentNotifications: boolean;
  }>({ id: 'User:user-1', fragment: BADGE_FRAGMENT });

describe('adjustUnreadNotificationCount', () => {
  it('shifts the count by the delta', () => {
    const cache = seedUser(5);
    adjustUnreadNotificationCount(cache, 'user-1', -1);
    expect(readBadge(cache)).toEqual({
      __typename: 'User',
      unreadNotificationCount: 4,
      hasUrgentNotifications: true,
    });

    adjustUnreadNotificationCount(cache, 'user-1', 1);
    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });

  it('clamps at zero instead of going negative', () => {
    const cache = seedUser(0);
    adjustUnreadNotificationCount(cache, 'user-1', -1);
    expect(readBadge(cache)?.unreadNotificationCount).toBe(0);
  });

  it('clears hasUrgentNotifications when the count lands at zero', () => {
    const cache = seedUser(1);
    adjustUnreadNotificationCount(cache, 'user-1', -1);
    expect(readBadge(cache)).toEqual({
      __typename: 'User',
      unreadNotificationCount: 0,
      hasUrgentNotifications: false,
    });
  });

  it('leaves hasUrgentNotifications alone while unread remain', () => {
    const cache = seedUser(3);
    adjustUnreadNotificationCount(cache, 'user-1', -1);
    expect(readBadge(cache)?.hasUrgentNotifications).toBe(true);
  });

  it('no-ops for a zero delta and for a falsy user id', () => {
    const cache = seedUser(5);
    adjustUnreadNotificationCount(cache, 'user-1', 0);
    adjustUnreadNotificationCount(cache, null, -1);
    adjustUnreadNotificationCount(cache, undefined, -1);
    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });

  it('does not throw when the user entity or its fields are absent', () => {
    const cache = seedUser(5);
    expect(() =>
      adjustUnreadNotificationCount(cache, 'unknown-user', -1),
    ).not.toThrow();
    // Entity present but the badge fields were never fetched — cache.modify
    // skips absent fields.
    const bare = seedCache([{ __typename: 'User', id: 'user-2', name: 'X' }]);
    expect(() =>
      adjustUnreadNotificationCount(bare, 'user-2', -1),
    ).not.toThrow();
  });
});

describe('clearUnreadNotificationCount', () => {
  it('zeroes the count and clears the urgent flag', () => {
    const cache = seedUser(7);
    clearUnreadNotificationCount(cache, 'user-1');
    expect(readBadge(cache)).toEqual({
      __typename: 'User',
      unreadNotificationCount: 0,
      hasUrgentNotifications: false,
    });
  });

  it('no-ops for a falsy user id', () => {
    const cache = seedUser(7);
    clearUnreadNotificationCount(cache, null);
    expect(readBadge(cache)?.unreadNotificationCount).toBe(7);
  });
});

/**
 * The notification transitions, exercised against a real cache.
 *
 * The property under test is that the row and the badge move together and only
 * when the read-state actually changed — a repeated event (a re-delivered
 * subscription push, a replayed offline mutation) must not double-count.
 */
import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { GetNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { UseNotificationsOnLaunch_NotificationFragmentDoc } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';
import {
  applyAllNotificationsRead,
  addNotificationToFeed,
  applyNotificationRead,
  applyNotificationRemoved,
  applyNotificationUnread,
  cachedUnreadNotificationIds,
  readNotificationStatus,
} from '../notificationCacheWrites';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const USER = 'me';

const node = (id: string, status: NotificationStatus) => ({
  __typename: 'Notification' as const,
  id,
  type: NotificationType.CollaborationInvite,
  priority: Priority.Normal,
  title: `T${id}`,
  message: `M${id}`,
  payload: {},
  category: NotificationCategory.Pantry,
  sentAt: `2026-08-0${id}T00:00:00.000Z`,
  expiresAt: null,
  sourceId: null,
  sourceType: null,
  actionUrl: null,
  readAt: null,
  status,
});

const seed = (
  cache: InMemoryCache,
  rows: Array<[string, NotificationStatus]>,
  unread: number,
) =>
  cache.writeQuery({
    query: GetNotificationsDocument,
    variables: { filter: undefined, first: 30 },
    data: {
      __typename: 'Query' as const,
      me: {
        __typename: 'User',
        id: USER,
        unreadNotificationCount: unread,
        hasUrgentNotifications: false,
        notificationsConnection: {
          __typename: 'NotificationConnection',
          edges: rows.map(([id, status]) => ({
            __typename: 'NotificationEdge' as const,
            node: node(id, status),
          })),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          totalCount: rows.length,
        },
      },
    },
  });

const badge = (cache: InMemoryCache): number =>
  (cache.extract() as Record<string, { unreadNotificationCount?: number }>)[
    `User:${USER}`
  ]?.unreadNotificationCount ?? -1;

describe('notification cache writes', () => {
  let cache: InMemoryCache;
  beforeEach(() => {
    cache = makeCache();
  });

  it('marks read, moving the row and the badge together', () => {
    seed(cache, [['1', NotificationStatus.Sent]], 1);

    expect(applyNotificationRead(cache, USER, '1')).toBe(true);
    expect(readNotificationStatus(cache, '1')).toBe(NotificationStatus.Read);
    expect(badge(cache)).toBe(0);
  });

  // The property that makes a re-delivered event safe.
  it('does not double-count a repeated mark-read', () => {
    seed(cache, [['1', NotificationStatus.Sent]], 1);

    applyNotificationRead(cache, USER, '1');
    expect(applyNotificationRead(cache, USER, '1')).toBe(false);
    expect(badge(cache)).toBe(0);
  });

  it('marks unread, and refuses when it was already unread', () => {
    seed(cache, [['1', NotificationStatus.Read]], 0);

    expect(applyNotificationUnread(cache, USER, '1')).toBe(true);
    expect(badge(cache)).toBe(1);
    expect(applyNotificationUnread(cache, USER, '1')).toBe(false);
    expect(badge(cache)).toBe(1);
  });

  it('removing an unread notification decrements; a read one does not', () => {
    seed(
      cache,
      [
        ['1', NotificationStatus.Sent],
        ['2', NotificationStatus.Read],
      ],
      1,
    );

    applyNotificationRemoved(cache, USER, '2');
    expect(badge(cache)).toBe(1);

    applyNotificationRemoved(cache, USER, '1');
    expect(badge(cache)).toBe(0);
  });

  it('a live arrival joins the feed without touching the badge', () => {
    seed(cache, [['1', NotificationStatus.Sent]], 1);
    // The subscription normalizes the entity; only the edge and badge are ours.
    cache.writeFragment({
      id: 'Notification:2',
      fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
      fragmentName: 'useNotificationsOnLaunch_notification',
      data: node('2', NotificationStatus.Sent),
    });

    addNotificationToFeed(cache, USER, '2', NotificationCategory.Pantry);

    // The count is re-seeded from the server on this path — see
    // `useNotificationListener`. Applying a delta here as well would
    // double-count it.
    expect(badge(cache)).toBe(1);
  });

  it('marks every cached unread row read and zeroes the badge', () => {
    seed(
      cache,
      [
        ['1', NotificationStatus.Sent],
        ['2', NotificationStatus.Read],
        ['3', NotificationStatus.Pending],
      ],
      2,
    );

    expect(cachedUnreadNotificationIds(cache).sort()).toEqual(['1', '3']);

    const flipped = applyAllNotificationsRead(cache, USER);

    expect(flipped.sort()).toEqual(['1', '3']);
    expect(readNotificationStatus(cache, '1')).toBe(NotificationStatus.Read);
    expect(readNotificationStatus(cache, '3')).toBe(NotificationStatus.Read);
    expect(badge(cache)).toBe(0);
  });

  it('reports an uncached notification as unknown, not as unread', () => {
    expect(readNotificationStatus(cache, 'nope')).toBeUndefined();
    expect(applyNotificationRead(cache, USER, 'nope')).toBe(false);
  });
});

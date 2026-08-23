/**
 * The notification feed, its read state and its counts have ONE source of
 * truth on the device (spec: notification-event-sync).
 *
 * These four cases are the spec's scenarios. They are written against the
 * Apollo cache because that is where the answer is supposed to live — a second
 * store holding the same notifications is exactly what they exist to rule out.
 * Each asserts that one sequence of events produces one answer, not that a
 * particular implementation was used.
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

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const node = (
  id: string,
  status: NotificationStatus = NotificationStatus.Sent,
) => ({
  __typename: 'Notification' as const,
  id,
  type: NotificationType.CollaborationInvite,
  priority: Priority.Normal,
  title: `Title ${id}`,
  message: `Message ${id}`,
  payload: {},
  category: NotificationCategory.Pantry,
  sentAt: `2026-08-0${id}T00:00:00.000Z`,
  expiresAt: null,
  sourceId: null,
  sourceType: null,
  actionUrl: null,
  readAt:
    status === NotificationStatus.Read ? '2026-08-23T00:00:00.000Z' : null,
  status,
});

const VARS = { filter: undefined, first: 30 };

const write = (cache: InMemoryCache, ids: string[], unread: number) =>
  cache.writeQuery({
    query: GetNotificationsDocument,
    variables: VARS,
    data: {
      __typename: 'Query' as const,
      me: {
        __typename: 'User',
        id: 'me',
        unreadNotificationCount: unread,
        hasUrgentNotifications: false,
        notificationsConnection: {
          __typename: 'NotificationConnection',
          edges: ids.map(id => ({
            __typename: 'NotificationEdge' as const,
            node: node(id),
          })),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          totalCount: ids.length,
        },
      },
    },
  });

// The query's own generated type is masked; these assertions reach through
// it deliberately, so the reads are shaped rather than typed.
type FeedShape = {
  me: {
    unreadNotificationCount: number;
    notificationsConnection: {
      edges: { node: { id: string; status: NotificationStatus } }[];
    };
  };
};

const read = (cache: InMemoryCache): FeedShape =>
  cache.readQuery({
    query: GetNotificationsDocument,
    variables: VARS,
  }) as unknown as FeedShape;

describe('the notification feed has one source of truth', () => {
  let cache: InMemoryCache;
  beforeEach(() => {
    cache = makeCache();
  });

  // Scenario: a real-time event arrives while the feed is on screen.
  it('a live event and the unread count describe the same set', () => {
    write(cache, ['1', '2'], 2);
    write(cache, ['1', '2', '3'], 3);

    const result = read(cache);
    expect(result.me.notificationsConnection.edges).toHaveLength(3);
    expect(result.me.unreadNotificationCount).toBe(3);
  });

  // Scenario: an optimistic read is reverted.
  it('an optimistic read that is reverted restores the item and the count together', () => {
    write(cache, ['1', '2'], 2);
    const snapshot = cache.extract();

    cache.modify({
      id: cache.identify({ __typename: 'Notification', id: '1' })!,
      fields: { status: () => NotificationStatus.Read },
    });
    cache.modify({
      id: 'User:me',
      fields: { unreadNotificationCount: (n: number) => n - 1 },
    });
    expect(read(cache).me.unreadNotificationCount).toBe(1);

    // One restore puts BOTH back, because both live in one store.
    cache.restore(snapshot);

    const after = read(cache);
    expect(after.me.notificationsConnection.edges[0].node.status).toBe(
      NotificationStatus.Sent,
    );
    expect(after.me.unreadNotificationCount).toBe(2);
  });

  // Scenario: history is paged in after events have already arrived.
  it('history paged in after live events contains each notification once', () => {
    write(cache, ['3'], 1);
    write(cache, ['3', '2', '1'], 3);

    const ids = read(cache).me.notificationsConnection.edges.map(
      e => e.node.id,
    );
    expect(ids).toEqual(['3', '2', '1']);
    expect(new Set(ids).size).toBe(ids.length);
    expect(read(cache).me.unreadNotificationCount).toBe(3);
  });

  // The property the other three rest on: writing the same notification twice
  // produces one entity, so there is nothing for two copies to disagree about.
  it('normalizes by id, so the same notification written twice is one entity', () => {
    write(cache, ['1'], 1);
    write(cache, ['1'], 1);

    const keys = Object.keys(cache.extract()).filter(k =>
      k.startsWith('Notification:'),
    );
    expect(keys).toEqual(['Notification:1']);
  });
});

/**
 * The four cases above describe what the cache does, and the cache already did
 * it — which is the point worth being precise about. The defect was never that
 * Apollo held the wrong answer; it was that a 592-line Zustand slice held a
 * second one, written from the same Apollo events and read independently. No
 * behavioural test could fail on that, because both copies were fed from the
 * same source and usually agreed.
 *
 * So the guard is structural: the notification slice may hold client state and
 * nothing else. If a server field reappears there, the second source of truth
 * is back, and this fails.
 */
describe('the notification slice holds no server state', () => {
  const SERVER_STATE = [
    'notifications',
    'unreadCount',
    'urgentCount',
    'lastFetchedAt',
    'addNotification',
    'addMultipleNotifications',
    'markAsRead',
    'markAsUnread',
    'markAllAsRead',
    'removeNotification',
    'clearAll',
    'updateUnreadCount',
    'setServerNotificationCounts',
    'getUnreadNotifications',
    'getNotificationsByCategory',
    'getUrgentNotifications',
  ];

  it('declares none of the fields that mirror the server feed', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(
        __dirname,
        '../../../store/slices/notificationSlice.ts',
      ),
      'utf8',
    );
    const declared = SERVER_STATE.filter(name =>
      new RegExp(`^\\s+${name}\\??:`, 'm').test(source),
    );
    expect(declared).toEqual([]);
  });
});

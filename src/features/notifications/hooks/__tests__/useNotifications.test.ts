'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type {
  MockFor,
  MockDataFor,
  QueryDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import {
  NotificationEventsDocument,
  GetUnreadNotificationsDocument,
  NotificationSummaryDocument,
} from '#features/notifications/graphql/notifications.generated';
import {
  NotificationType,
  NotificationCategory,
  NotificationStatus,
  NotificationSubtype,
  Priority,
  MutationType,
} from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import { NotificationForEventDocument } from '#features/notifications/hooks/useNotifications.generated';
import type { UseNotificationsOnLaunch_NotificationFragment } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';
import { readNotificationStatus } from '#features/notifications/utils/notificationCacheWrites';
import { useNotifications, useNotificationListener } from '../useNotifications';
import { reportSubscriptionError } from '#utils/subscriptionErrorHandler';
import { logger } from '#/utils/environment';
import { memoryLifecycle } from '#/test-utils/memoryPlatform';

// Mutable so a test can simulate a logged-out session. Prefixed `mock` so the
// jest.mock factory below may reference it.
let mockUser: { id: string } | null = { id: 'user-1' };

// The store holds no notifications — only the signed-in user and the
// expiration buffer.
type MockNotificationsState = {
  user: { id: string } | null;
  pendingExpirationLinks: Record<string, unknown>;
  linkExpirationData: jest.Mock;
  setExpirationAction: jest.Mock;
  clearExpirationLink: jest.Mock;
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: (s: MockNotificationsState) => unknown) =>
    selector({
      user: mockUser,
      pendingExpirationLinks: {},
      linkExpirationData: jest.fn(),
      setExpirationAction: jest.fn(),
      clearExpirationLink: jest.fn(),
    }),
  ),
  // Transport recovery reads connectivity; a partial factory here would
  // otherwise make every subscription in this suite throw on mount.
  useIsOnline: jest.fn(() => true),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: <S, U>(fn: (state: S) => U) => fn,
}));

jest.mock('#store', () => ({
  useStore: {
    getState: () => ({ pendingExpirationLinks: {} }),
  },
}));

jest.mock('#utils/subscriptionErrorHandler', () => ({
  ...jest.requireActual<object>('#utils/subscriptionErrorHandler'),
  reportSubscriptionError: jest.fn(),
}));

const mockSyncMarkAsRead = jest.fn();
const mockSyncDelete = jest.fn();
const mockSyncMarkAllAsRead = jest.fn();

jest.mock('../useNotificationSync', () => ({
  useNotificationSync: () => ({
    syncMarkAsRead: mockSyncMarkAsRead,
    syncDelete: mockSyncDelete,
    syncMarkAllAsRead: mockSyncMarkAllAsRead,
    syncClearRead: jest.fn(),
  }),
}));

jest.mock('../useNotificationSettings', () => ({
  useNotificationSettings: () => ({
    settings: {
      pantryChanges: true,
      lowStockAlerts: true,
      expirationNotifications: true,
      shoppingListUpdates: true,
      sharedListUpdates: true,
      collaborationInvites: true,
      homeInvites: true,
    },
    isQuietTime: jest.fn().mockReturnValue(false),
  }),
}));

/** A CREATED event, which carries the id, and the read-back of its row. */
function arrivedNotificationMocks(notification: {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isAuthoredContent?: boolean;
  data?: UseNotificationsOnLaunch_NotificationFragment['data'];
}): [
  MockFor<typeof NotificationEventsDocument>,
  MockFor<typeof NotificationForEventDocument>,
] {
  return [
    {
      request: { query: NotificationEventsDocument },
      result: {
        data: {
          notificationEvents: {
            __typename: 'NotificationEvent',
            subtype: NotificationSubtype.Created,
            mutation: MutationType.Created,
            timestamp: '2024-01-01T00:00:00Z',
            affectedCount: null,
            node: {
              __typename: 'Notification',
              id: notification.id,
              status: NotificationStatus.Pending,
            },
          },
        },
      },
    },
    {
      request: {
        query: NotificationForEventDocument,
        variables: { id: notification.id },
      },
      result: {
        data: {
          notification: {
            __typename: 'Notification',
            id: notification.id,
            type: notification.type,
            isAuthoredContent: notification.isAuthoredContent ?? false,
            status: NotificationStatus.Pending,
            priority: Priority.Normal,
            title: notification.title,
            message: notification.message,
            payload: null,
            data: notification.data ?? null,
            category: NotificationCategory.System,
            sentAt: '2024-01-01T00:00:00Z',
            expiresAt: null,
            sourceId: null,
            sourceType: null,
            pantryItemId: null,
            actionUrl: null,
            readAt: null,
          },
        },
      },
    },
  ];
}

// Status-transition / aggregate event mock. READ and DISMISSED carry the row's
// id and status; BULK_* subtypes carry a null node and an affectedCount,
// mirroring the server's aggregate publisher.
function buildTransitionEventMock(
  subtype: NotificationSubtype,
  nodeId: string | null,
  affectedCount: number | null = null,
): MockFor<typeof NotificationEventsDocument> {
  return {
    request: {
      query: NotificationEventsDocument,
    },
    result: {
      data: {
        notificationEvents: {
          __typename: 'NotificationEvent',
          subtype,
          mutation: MutationType.Updated,
          timestamp: '2024-01-01T00:00:00Z',
          affectedCount,
          node:
            nodeId === null
              ? null
              : {
                  __typename: 'Notification',
                  id: nodeId,
                  status: NotificationStatus.Read,
                },
        },
      },
    },
  };
}

// What the server-event re-read answers: the badge after the event.
const summaryData: MockDataFor<typeof NotificationSummaryDocument> = {
  notificationSummary: {
    __typename: 'NotificationSummary',
    id: 'user-1',
    unreadCount: 0,
    hasUrgent: false,
  },
};

const unreadFeedData: MockDataFor<typeof GetUnreadNotificationsDocument> = {
  notificationSummary: {
    __typename: 'NotificationSummary',
    id: 'user-1',
    unreadCount: 0,
    hasUrgent: false,
  },
  me: {
    __typename: 'User',
    id: 'user-1',
    notificationsConnection: {
      __typename: 'NotificationConnection',
      edges: [],
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: false,
        endCursor: null,
      },
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'user-1' };
  // The installed lifecycle is shared by the file; a test that moved it and
  // failed before moving it back would otherwise run every later test away.
  memoryLifecycle().moveTo('active');
});

// A cache the hook can write through. Seeded with the badge so there is a
// count to re-read, and with rows so the transition tests have one to move.
const seededCache = (
  rows: Array<{ id: string; status: NotificationStatus }> = [],
) => {
  const cache = makeCache();
  const data: QueryDataFor<typeof GetUnreadNotificationsDocument> = {
    __typename: 'Query',
    notificationSummary: {
      __typename: 'NotificationSummary',
      id: 'user-1',
      unreadCount: rows.filter(r =>
        [NotificationStatus.Pending, NotificationStatus.Sent].includes(
          r.status,
        ),
      ).length,
      hasUrgent: false,
    },
    me: {
      __typename: 'User',
      id: 'user-1',
      notificationsConnection: {
        __typename: 'NotificationConnection',
        edges: rows.map(r => ({
          __typename: 'NotificationEdge',
          node: {
            __typename: 'Notification',
            id: r.id,
            type: NotificationType.LowStock,
            isAuthoredContent: false,
            status: r.status,
            priority: Priority.Normal,
            title: 'Low Stock Alert',
            message: 'Milk is running low',
            payload: null,
            data: null,
            category: NotificationCategory.System,
            sentAt: '2024-01-01T00:00:00Z',
            expiresAt: null,
            sourceId: null,
            sourceType: null,
            pantryItemId: null,
            actionUrl: null,
            readAt: null,
          },
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  };
  cache.writeQuery({ query: GetUnreadNotificationsDocument, data });
  return cache;
};

const badgeCount = (cache: ReturnType<typeof makeCache>): number =>
  cache.readQuery({ query: NotificationSummaryDocument })?.notificationSummary
    .unreadCount ?? -1;

describe('useNotifications', () => {
  // The hook is now only the write side. Its read side — the feed, the unread
  // count — is `useNotificationHistory` reading the Apollo cache, so there is
  // nothing here that could disagree with what the list renders.
  it('exposes the four write actions and no feed of its own', () => {
    const { result } = renderHookWithApollo(() => useNotifications());

    expect(typeof result.current.handleMarkAsRead).toBe('function');
    expect(typeof result.current.handleMarkAllAsRead).toBe('function');
    expect(typeof result.current.handleRemoveNotification).toBe('function');
    expect(typeof result.current.handleClearRead).toBe('function');
    expect(result.current).not.toHaveProperty('notifications');
    expect(result.current).not.toHaveProperty('unreadCount');
  });

  it('handleMarkAllAsRead calls syncMarkAllAsRead', async () => {
    const { result } = renderHookWithApollo(() => useNotifications());

    await act(async () => {
      await result.current.handleMarkAllAsRead();
    });

    expect(mockSyncMarkAllAsRead).toHaveBeenCalled();
  });

  it('does not open subscriptions (listener is provider-only)', async () => {
    // A created-event mock is available, but useNotifications must not
    // subscribe — only useNotificationListener (mounted once in
    // NotificationProvider) opens the server subscriptions.
    const cache = seededCache();
    renderHookWithApollo(() => useNotifications(), {
      cache,
      operationMocks: [
        ...arrivedNotificationMocks({
          id: 'notif-1',
          type: NotificationType.LowStock,
          title: 'Low Stock Alert',
          message: 'Milk is running low',
        }),
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(badgeCount(cache)).toBe(0);
  });
});

describe('useNotificationListener', () => {
  it('skips subscription when config.skip is true', async () => {
    const cache = seededCache();
    renderHookWithApollo(() => useNotificationListener({ skip: true }), {
      cache,
      operationMocks: [
        ...arrivedNotificationMocks({
          id: 'notif-1',
          type: NotificationType.LowStock,
          title: 'Low Stock Alert',
          message: 'Milk is running low',
        }),
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(badgeCount(cache)).toBe(0);
  });

  // The host draws the tray entry from this event. An admin's announcement
  // has to reach it in the admin's words — dropped from the copy source, it
  // was drawn with the template for its notification type.
  it("hands an authored announcement over in its author's words", async () => {
    memoryLifecycle().moveTo('background');
    const onArrivedWhileAway = jest.fn();

    const arrival = arrivedNotificationMocks({
      id: 'notif-authored',
      type: NotificationType.HomeJoined,
      isAuthoredContent: true,
      title: 'Scheduled maintenance',
      message: 'The app is offline tonight from 2 to 3.',
    });

    renderHookWithApollo(
      () => useNotificationListener({ onArrivedWhileAway }),
      {
        cache: seededCache(),
        operationMocks: [
          ...arrival,
          recordMock(NotificationSummaryDocument, { data: summaryData }).mock,
        ],
      },
    );

    await waitFor(() =>
      expect(onArrivedWhileAway).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Scheduled maintenance',
          body: 'The app is offline tonight from 2 to 3.',
        }),
      ),
    );
  });

  // In the foreground the feed shows it; nothing is drawn in the tray.
  it('hands nothing over while the app is active', async () => {
    const onArrivedWhileAway = jest.fn();
    const summary = recordMock(NotificationSummaryDocument, {
      data: summaryData,
    });

    renderHookWithApollo(
      () => useNotificationListener({ onArrivedWhileAway }),
      {
        cache: seededCache(),
        operationMocks: [
          ...arrivedNotificationMocks({
            id: 'notif-foreground',
            type: NotificationType.LowStock,
            title: 'Low Stock Alert',
            message: 'Milk is running low',
          }),
          summary.mock,
        ],
      },
    );

    await waitFor(() => expect(summary.fired).toHaveLength(1));
    expect(onArrivedWhileAway).not.toHaveBeenCalled();
  });

  it('a CREATED event lands in the cache and re-reads the count', async () => {
    const cache = seededCache();
    const { mock, fired } = recordMock(NotificationSummaryDocument, {
      data: {
        notificationSummary: {
          ...summaryData.notificationSummary,
          unreadCount: 1,
        },
      },
    });

    renderHookWithApollo(() => useNotificationListener(), {
      cache,
      operationMocks: [
        ...arrivedNotificationMocks({
          id: 'notif-1',
          type: NotificationType.LowStock,
          title: 'Low Stock Alert',
          message: 'Milk is running low',
          data: {
            __typename: 'LowStockNotificationData',
            itemName: 'Milk',
            currentQuantity: 1,
          },
        }),
        mock,
      ],
    });

    await waitFor(() => {
      expect(readNotificationStatus(cache, 'notif-1')).toBe(
        NotificationStatus.Pending,
      );
    });
    // The count is the server's, not a local +1 — see the comment on
    // `reseedUnreadCount`.
    await waitFor(() => {
      expect(fired.length).toBeGreaterThan(0);
      expect(badgeCount(cache)).toBe(1);
    });
  });

  // The badge is re-read, never moved here: a handler that asked the cache
  // "was this unread?" would answer from whatever wrote the row last, and
  // leave the badge stuck while the row moved.
  it('READ subtype marks the row read AND re-reads Query.notificationSummary', async () => {
    const cache = seededCache([
      { id: 'notif-1', status: NotificationStatus.Sent },
    ]);
    expect(badgeCount(cache)).toBe(1);
    const { mock, fired } = recordMock(NotificationSummaryDocument, {
      data: summaryData,
    });

    renderHookWithApollo(() => useNotificationListener(), {
      cache,
      operationMocks: [
        buildTransitionEventMock(NotificationSubtype.Read, 'notif-1'),
        mock,
      ],
    });

    await waitFor(() => {
      expect(readNotificationStatus(cache, 'notif-1')).toBe(
        NotificationStatus.Read,
      );
    });
    // The badge lands when the re-query resolves, not when it is issued.
    await waitFor(() => {
      expect(fired.length).toBeGreaterThan(0);
      expect(badgeCount(cache)).toBe(0);
    });
  });

  it('DISMISSED subtype removes the row AND re-reads the count', async () => {
    const cache = seededCache([
      { id: 'notif-2', status: NotificationStatus.Sent },
    ]);
    const { mock, fired } = recordMock(NotificationSummaryDocument, {
      data: summaryData,
    });

    renderHookWithApollo(() => useNotificationListener(), {
      cache,
      operationMocks: [
        buildTransitionEventMock(NotificationSubtype.Dismissed, 'notif-2'),
        mock,
      ],
    });

    await waitFor(() => {
      expect(readNotificationStatus(cache, 'notif-2')).toBeUndefined();
    });
    await waitFor(() => {
      expect(fired.length).toBeGreaterThan(0);
      expect(badgeCount(cache)).toBe(0);
    });
  });

  it.each([
    NotificationSubtype.BulkRead,
    NotificationSubtype.BulkCleared,
    NotificationSubtype.BulkExpired,
  ])('%s event (null node) re-queries the unread feed', async subtype => {
    const { mock, fired } = recordMock(GetUnreadNotificationsDocument, {
      data: unreadFeedData,
    });
    const cache = seededCache([
      { id: 'notif-1', status: NotificationStatus.Sent },
    ]);

    renderHookWithApollo(() => useNotificationListener(), {
      cache,
      operationMocks: [buildTransitionEventMock(subtype, null, 4), mock],
    });

    // The aggregate event's rows are unknown client-side — the handler must
    // fall back to a server re-sync instead of guessing at the local ones. The
    // feed query states the badge as well.
    await waitFor(() => {
      expect(fired.length).toBeGreaterThan(0);
      expect(badgeCount(cache)).toBe(0);
    });
    expect(readNotificationStatus(cache, 'notif-1')).toBe(
      NotificationStatus.Sent,
    );
  });

  describe('subscription errors', () => {
    const erroringSubscription = (
      error: Error,
    ): MockFor<typeof NotificationEventsDocument> => ({
      request: { query: NotificationEventsDocument },
      error,
    });
    const warnedAboutSubscription = () =>
      jest
        .mocked(logger.warn)
        .mock.calls.some(
          ([first]) =>
            typeof first === 'string' && first.includes('subscription error'),
        );

    it('does not warn about a socket close, which reconnects on its own', async () => {
      renderHookWithApollo(() => useNotificationListener(), {
        operationMocks: [
          erroringSubscription(new Error('Socket closed with event 1006 ')),
        ],
      });

      await waitFor(() => {
        expect(reportSubscriptionError).toHaveBeenCalled();
      });
      expect(warnedAboutSubscription()).toBe(false);
    });

    it('warns about a server error whose message mentions a connection', async () => {
      renderHookWithApollo(() => useNotificationListener(), {
        operationMocks: [
          erroringSubscription(
            new Error('Database connection lost while resolving the stream'),
          ),
        ],
      });

      await waitFor(() => {
        expect(reportSubscriptionError).toHaveBeenCalled();
      });
      expect(warnedAboutSubscription()).toBe(true);
    });
  });
});

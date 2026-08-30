'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import {
  NotificationEventsDocument,
  GetUnreadNotificationsDocument,
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
import { readNotificationStatus } from '#features/notifications/utils/notificationCacheWrites';
import { useNotifications, useNotificationListener } from '../useNotifications';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// Mutable so a test can simulate a logged-out session. Prefixed `mock` so the
// jest.mock factory below may reference it.
let mockUser: { id: string } | null = { id: 'user-1' };

const mockRegisterFcmTapHandlers = jest.fn(() => jest.fn());
const mockRegisterIosPushTapHandlers = jest.fn(() => jest.fn());

jest.mock('#/services/push/nativePushMessaging', () => ({
  registerFcmTapHandlers: () => mockRegisterFcmTapHandlers(),
}));
jest.mock('#/services/push/iosPushMessaging', () => ({
  registerIosPushTapHandlers: () => mockRegisterIosPushTapHandlers(),
}));

// The store no longer holds notifications — only the signed-in user (which
// gates push-tap registration) and the expiration buffer.
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

jest.mock('#utils/notifications/localNotificationHelper', () => ({
  showLocalNotification: jest.fn(),
}));

jest.mock('#utils/subscriptionErrorHandler', () => ({
  handleSubscriptionError: jest.fn(),
  clearAllRetryStates: jest.fn(),
}));

const mockSyncMarkAsRead = jest.fn();
const mockSyncDelete = jest.fn();
const mockSyncMarkAllAsRead = jest.fn();

jest.mock('../useNotificationSync', () => ({
  useNotificationSync: () => ({
    syncMarkAsRead: mockSyncMarkAsRead,
    syncMarkUnread: jest.fn(),
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

function buildNotificationSubscriptionMock(
  notification: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    payload?: Record<string, unknown>;
    sentAt?: string;
  },
  variant: 'created' | 'updated' = 'created',
): MockedResponse {
  const isCreated = variant === 'created';
  return {
    request: {
      query: NotificationEventsDocument,
    },
    result: {
      data: {
        notificationEvents: {
          __typename: 'NotificationEvent' as const,
          subtype: isCreated
            ? NotificationSubtype.Created
            : NotificationSubtype.Updated,
          mutation: isCreated ? MutationType.Created : MutationType.Updated,
          timestamp: '2024-01-01T00:00:00Z',
          affectedCount: null,
          node: {
            __typename: 'Notification' as const,
            id: notification.id,
            type: notification.type,
            status: NotificationStatus.Pending,
            priority: Priority.Normal,
            title: notification.title,
            message: notification.message,
            payload: notification.payload ?? null,
            category: NotificationCategory.System,
            sentAt: notification.sentAt ?? '2024-01-01T00:00:00Z',
            expiresAt: null,
            sourceId: null,
            sourceType: null,
            actionUrl: null,
            readAt: null,
          },
        },
      },
    },
  };
}

// Status-transition / aggregate event mock. READ and DISMISSED carry a node
// (only the id is needed by the handler); BULK_* subtypes carry a null node
// and an affectedCount, mirroring the server's aggregate publisher.
function buildTransitionEventMock(
  subtype: NotificationSubtype,
  nodeId: string | null,
  affectedCount: number | null = null,
): MockedResponse {
  return {
    request: {
      query: NotificationEventsDocument,
    },
    result: {
      data: {
        notificationEvents: {
          __typename: 'NotificationEvent' as const,
          subtype,
          mutation: MutationType.Updated,
          timestamp: '2024-01-01T00:00:00Z',
          affectedCount,
          node:
            nodeId === null
              ? null
              : {
                  __typename: 'Notification' as const,
                  id: nodeId,
                  type: NotificationType.LowStock,
                  status: NotificationStatus.Read,
                  priority: Priority.Normal,
                  title: 'Low Stock Alert',
                  message: 'Milk is running low',
                  payload: null,
                  category: NotificationCategory.System,
                  sentAt: '2024-01-01T00:00:00Z',
                  expiresAt: null,
                  sourceId: null,
                  sourceType: null,
                  actionUrl: null,
                  readAt: '2024-01-01T00:01:00Z',
                },
        },
      },
    },
  };
}

const unreadFeedData = {
  me: {
    __typename: 'User' as const,
    id: 'user-1',
    unreadNotificationCount: 0,
    hasUrgentNotifications: false,
    notificationsConnection: {
      __typename: 'NotificationConnection' as const,
      edges: [],
      pageInfo: {
        __typename: 'PageInfo' as const,
        hasNextPage: false,
        endCursor: null,
      },
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'user-1' };
});

// A cache the hook can write through. Seeded with the signed-in user so the
// badge field exists to be adjusted, and with one notification so the
// transition tests have a row to move.
const seededCache = (
  rows: Array<{ id: string; status: NotificationStatus }> = [],
) => {
  const cache = makeCache();
  cache.writeQuery({
    query: GetUnreadNotificationsDocument,
    data: {
      __typename: 'Query' as const,
      me: {
        __typename: 'User' as const,
        id: 'user-1',
        unreadNotificationCount: rows.filter(r =>
          [NotificationStatus.Pending, NotificationStatus.Sent].includes(
            r.status,
          ),
        ).length,
        hasUrgentNotifications: false,
        notificationsConnection: {
          __typename: 'NotificationConnection' as const,
          edges: rows.map(r => ({
            __typename: 'NotificationEdge' as const,
            node: {
              __typename: 'Notification' as const,
              id: r.id,
              type: NotificationType.LowStock,
              status: r.status,
              priority: Priority.Normal,
              title: 'Low Stock Alert',
              message: 'Milk is running low',
              payload: null,
              category: NotificationCategory.System,
              sentAt: '2024-01-01T00:00:00Z',
              expiresAt: null,
              sourceId: null,
              sourceType: null,
              actionUrl: null,
              readAt: null,
            },
          })),
          pageInfo: {
            __typename: 'PageInfo' as const,
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    },
  });
  return cache;
};

const badgeCount = (cache: ReturnType<typeof makeCache>): number =>
  (cache.extract() as Record<string, { unreadNotificationCount?: number }>)[
    'User:user-1'
  ]?.unreadNotificationCount ?? -1;

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

  it('handleMarkAllAsRead calls syncMarkAllAsRead', () => {
    const { result } = renderHookWithApollo(() => useNotifications());

    act(() => {
      result.current.handleMarkAllAsRead();
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
        buildNotificationSubscriptionMock({
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
        buildNotificationSubscriptionMock({
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

  it('a CREATED event lands in the cache and re-reads the count', async () => {
    const cache = seededCache();
    const { mock, fired } = recordMock(GetUnreadNotificationsDocument, {
      data: unreadFeedData,
    });

    renderHookWithApollo(() => useNotificationListener(), {
      cache,
      operationMocks: [
        buildNotificationSubscriptionMock({
          id: 'notif-1',
          type: NotificationType.LowStock,
          title: 'Low Stock Alert',
          message: 'Milk is running low',
          payload: { itemName: 'Milk' },
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
    });
  });

  // The regression this design exists to prevent: Apollo normalizes the
  // event's `node` into the cache before `onData` runs, so a handler that
  // asked the cache "was this unread?" would always be told "no" and would
  // leave the badge stuck while the row moved.
  it('READ subtype marks the row read AND re-reads the count', async () => {
    const cache = seededCache([
      { id: 'notif-1', status: NotificationStatus.Sent },
    ]);
    expect(badgeCount(cache)).toBe(1);
    const { mock, fired } = recordMock(GetUnreadNotificationsDocument, {
      data: unreadFeedData,
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
    const { mock, fired } = recordMock(GetUnreadNotificationsDocument, {
      data: unreadFeedData,
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
    // fall back to a server re-sync instead of guessing at the local ones.
    await waitFor(() => {
      expect(fired.length).toBeGreaterThan(0);
    });
    expect(readNotificationStatus(cache, 'notif-1')).toBe(
      NotificationStatus.Sent,
    );
  });

  it('registers push tap handlers when authenticated', async () => {
    renderHookWithApollo(() => useNotificationListener());

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRegisterFcmTapHandlers).toHaveBeenCalledTimes(1);
    expect(mockRegisterIosPushTapHandlers).toHaveBeenCalledTimes(1);
  });

  it('does not register push tap handlers (consuming the cold-start tap) when logged out', async () => {
    mockUser = null;
    renderHookWithApollo(() => useNotificationListener());

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRegisterFcmTapHandlers).not.toHaveBeenCalled();
    expect(mockRegisterIosPushTapHandlers).not.toHaveBeenCalled();
  });

  it('does not register push tap handlers when config.skip is true', async () => {
    renderHookWithApollo(() => useNotificationListener({ skip: true }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRegisterFcmTapHandlers).not.toHaveBeenCalled();
    expect(mockRegisterIosPushTapHandlers).not.toHaveBeenCalled();
  });
});

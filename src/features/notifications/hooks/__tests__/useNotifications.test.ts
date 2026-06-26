'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { NotificationEventsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  NotificationType,
  NotificationCategory,
  NotificationStatus,
  NotificationEventSubtype,
  Priority,
  MutationType,
} from '#/graphql/generated/schemaTypes';
import { useNotifications, useNotificationListener } from '../useNotifications';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockAddNotification = jest.fn();
const mockMarkAsRead = jest.fn();
const mockRemoveNotification = jest.fn();
const mockClearAll = jest.fn();
const mockGetNotificationsByCategory = jest.fn().mockReturnValue([]);

type MockNotificationsState = {
  notifications: unknown[];
  user: { id: string };
  addNotification: jest.Mock;
  markAsRead: jest.Mock;
  removeNotification: jest.Mock;
  clearAll: jest.Mock;
  getNotificationsByCategory: jest.Mock;
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: (s: MockNotificationsState) => unknown) =>
    selector({
      notifications: [],
      user: { id: 'user-1' },
      addNotification: mockAddNotification,
      markAsRead: mockMarkAsRead,
      removeNotification: mockRemoveNotification,
      clearAll: mockClearAll,
      getNotificationsByCategory: mockGetNotificationsByCategory,
    }),
  ),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: <S, U>(fn: (state: S) => U) => fn,
}));

jest.mock('#store', () => ({
  useStore: {
    getState: () => ({
      notifications: [
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: true },
      ],
    }),
  },
}));

jest.mock('#utils/notifications/localNotificationHelper', () => ({
  showLocalNotification: jest.fn(),
}));

jest.mock('#store/slices/notificationSlice', () => ({
  NotificationPriority: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  },
  isNotificationPayload: (value: unknown): boolean =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
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
          __typename: 'NotificationEvent',
          subtype: isCreated
            ? NotificationEventSubtype.Created
            : NotificationEventSubtype.Updated,
          mutation: isCreated ? MutationType.Created : MutationType.Updated,
          actorUserId: null,
          timestamp: '2024-01-01T00:00:00Z',
          node: {
            __typename: 'Notification',
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNotifications', () => {
  it('returns notifications from store', () => {
    const { result } = renderHookWithApollo(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
  });

  it('returns expected functions', () => {
    const { result } = renderHookWithApollo(() => useNotifications());

    expect(typeof result.current.handleMarkAsRead).toBe('function');
    expect(typeof result.current.handleMarkAllAsRead).toBe('function');
    expect(typeof result.current.handleRemoveNotification).toBe('function');
    expect(typeof result.current.clearAll).toBe('function');
    expect(typeof result.current.getNotificationsByCategory).toBe('function');
  });

  it('handleMarkAllAsRead calls syncMarkAllAsRead', () => {
    const { result } = renderHookWithApollo(() => useNotifications());

    act(() => {
      result.current.handleMarkAllAsRead();
    });

    expect(mockSyncMarkAllAsRead).toHaveBeenCalled();
  });

  it('clearAll is passed through from store', () => {
    const { result } = renderHookWithApollo(() => useNotifications());

    expect(result.current.clearAll).toBe(mockClearAll);
  });

  it('getNotificationsByCategory is passed through from store', () => {
    const { result } = renderHookWithApollo(() => useNotifications());

    expect(result.current.getNotificationsByCategory).toBe(
      mockGetNotificationsByCategory,
    );
  });

  it('does not open subscriptions (listener is provider-only)', async () => {
    // A created-event mock is available, but useNotifications must not
    // subscribe — only useNotificationListener (mounted once in
    // NotificationProvider) opens the server subscriptions.
    renderHookWithApollo(() => useNotifications(), {
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
    expect(mockAddNotification).not.toHaveBeenCalled();
  });
});

describe('useNotificationListener', () => {
  it('skips subscription when config.skip is true', async () => {
    // No subscription should fire; the hook mounts without error.
    renderHookWithApollo(() => useNotificationListener({ skip: true }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockAddNotification).not.toHaveBeenCalled();
  });

  it('subscription processes incoming notification data', async () => {
    renderHookWithApollo(() => useNotificationListener(), {
      operationMocks: [
        buildNotificationSubscriptionMock({
          id: 'notif-1',
          type: NotificationType.LowStock,
          title: 'Low Stock Alert',
          message: 'Milk is running low',
          payload: { itemName: 'Milk' },
        }),
      ],
    });

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.LowStock,
          title: 'Low Stock Alert',
          message: 'Milk is running low',
        }),
      );
    });
  });
});

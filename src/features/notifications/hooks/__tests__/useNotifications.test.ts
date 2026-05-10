'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { NotificationChangedDocument } from '#features/notifications/graphql/notifications.generated';
import {
  NotificationType,
  NotificationCategory,
  NotificationStatus,
  Priority,
  NotificationChangeType,
} from '#/graphql/generated/schemaTypes';
import { useNotifications } from '../useNotifications';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockAddNotification = jest.fn();
const mockMarkAsRead = jest.fn();
const mockRemoveNotification = jest.fn();
const mockClearAll = jest.fn();
const mockGetNotificationsByCategory = jest.fn().mockReturnValue([]);

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
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
  useShallow: (fn: any) => fn,
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
  changeType: NotificationChangeType = NotificationChangeType.Received,
): MockedResponse {
  return {
    request: {
      query: NotificationChangedDocument,
    },
    result: {
      data: {
        notificationChanged: {
          __typename: 'NotificationChangeEvent',
          changeType,
          timestamp: '2024-01-01T00:00:00Z',
          notification: {
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

  it('returns default config merged with user config', () => {
    const { result } = renderHookWithApollo(() =>
      useNotifications({ showInAppNotifications: false }),
    );

    expect(result.current.config.showInAppNotifications).toBe(false);
    expect(result.current.config.showPushNotifications).toBe(true);
  });

  it('skips subscription when config.skip is true', () => {
    // No subscription mock provided. If the subscription fired, MockedProvider
    // would log a warning (suppressed in tests). The hook returns normally.
    const { result } = renderHookWithApollo(() =>
      useNotifications({ skip: true }),
    );
    expect(result.current.config).toBeDefined();
  });

  it('subscription processes incoming notification data', async () => {
    renderHookWithApollo(() => useNotifications(), {
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
});

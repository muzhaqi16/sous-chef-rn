'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { NotificationType } from '../../../graphql/generated/schemaTypes';
import { useNotifications } from '../useNotifications';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

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

const mockSubscriptionOnData = jest.fn();
jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useSubscription: jest.fn((doc: any, opts: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'NotificationChanged') {
      if (opts?.onData) {
        mockSubscriptionOnData.mockImplementation(opts.onData);
      }
      return {};
    }
    return {};
  }),
}));

jest.mock('#utils/notifications/localNotificationHelper', () => ({
  showLocalNotification: jest.fn(),
}));

jest.mock('#store/slices/notificationSlice', () => ({
  NotificationPriority: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNotifications', () => {
  it('returns notifications from store', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
  });

  it('returns expected functions', () => {
    const { result } = renderHook(() => useNotifications());

    expect(typeof result.current.handleMarkAsRead).toBe('function');
    expect(typeof result.current.handleMarkAllAsRead).toBe('function');
    expect(typeof result.current.handleRemoveNotification).toBe('function');
    expect(typeof result.current.clearAll).toBe('function');
    expect(typeof result.current.getNotificationsByCategory).toBe('function');
  });

  it('handleMarkAllAsRead calls syncMarkAllAsRead', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.handleMarkAllAsRead();
    });

    expect(mockSyncMarkAllAsRead).toHaveBeenCalled();
  });

  it('returns default config merged with user config', () => {
    const { result } = renderHook(() =>
      useNotifications({ showInAppNotifications: false }),
    );

    expect(result.current.config.showInAppNotifications).toBe(false);
    expect(result.current.config.showPushNotifications).toBe(true);
  });

  it('skips subscription when config.skip is true', () => {
    const { useSubscription } = require('@apollo/client/react');

    renderHook(() => useNotifications({ skip: true }));

    expect(useSubscription).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    );
  });

  it('subscription processes incoming notification data', () => {
    renderHook(() => useNotifications());

    // Simulate subscription data
    act(() => {
      mockSubscriptionOnData({
        data: {
          data: {
            notificationChanged: {
              changeType: 'RECEIVED',
              notification: {
                id: 'notif-1',
                type: NotificationType.LowStock,
                title: 'Low Stock Alert',
                message: 'Milk is running low',
                payload: { itemName: 'Milk' },
                sentAt: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      });
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.LowStock,
        title: 'Low Stock Alert',
        message: 'Milk is running low',
      }),
    );
  });

  it('clearAll is passed through from store', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.clearAll).toBe(mockClearAll);
  });

  it('getNotificationsByCategory is passed through from store', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.getNotificationsByCategory).toBe(
      mockGetNotificationsByCategory,
    );
  });
});

'use no memo';

import { renderHook, act } from '@testing-library/react-native';
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
jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useNotificationChangedSubscription: jest.fn((opts: any) => {
    mockSubscriptionOnData.mockImplementation(opts.onData);
    return {};
  }),
}));

jest.mock('#utils/notifications/localNotificationHelper', () => ({
  showLocalNotification: jest.fn(),
}));

jest.mock('#utils/notifications/notificationParser', () => ({
  getNotificationTitle: jest.fn().mockReturnValue('Test Title'),
  getNotificationMessage: jest.fn().mockReturnValue('Test Message'),
  getNotificationCategory: jest.fn().mockReturnValue('PANTRY'),
}));

jest.mock('#store/slices/notificationSlice', () => ({
  NotificationCategory: {
    PANTRY: 'PANTRY',
    SHOPPING_LIST: 'SHOPPING_LIST',
    SECURITY: 'SECURITY',
    SYSTEM: 'SYSTEM',
  },
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

  it('handleMarkAllAsRead marks all unread notifications', async () => {
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.handleMarkAllAsRead();
    });

    expect(mockMarkAsRead).toHaveBeenCalledWith('n1');
    expect(mockMarkAsRead).not.toHaveBeenCalledWith('n2');
  });

  it('returns default config merged with user config', () => {
    const { result } = renderHook(() =>
      useNotifications({ enablePantryNotifications: false }),
    );

    expect(result.current.config.enablePantryNotifications).toBe(false);
    expect(result.current.config.enableShoppingListNotifications).toBe(true);
  });

  it('skips subscription when config.skip is true', () => {
    const { useNotificationChangedSubscription } = require('#generated');

    renderHook(() => useNotifications({ skip: true }));

    expect(useNotificationChangedSubscription).toHaveBeenCalledWith(
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
              changeType: 'CREATED',
              notification: {
                id: 'notif-1',
                type: 'LOW_STOCK',
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
        type: 'LOW_STOCK',
        title: 'Test Title',
        message: 'Test Message',
      }),
    );
  });

  it('updateConfig logs config changes', () => {
    const { result } = renderHook(() => useNotifications());

    result.current.updateConfig({ showInAppNotifications: false });

    expect(console.log).toHaveBeenCalledWith(
      'Updating notification config:',
      expect.any(Object),
    );
  });

  it('clearAll is passed through from store', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.clearAll).toBe(mockClearAll);
  });

  it('getNotificationsByCategory is passed through from store', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.getNotificationsByCategory).toBe(mockGetNotificationsByCategory);
  });
});

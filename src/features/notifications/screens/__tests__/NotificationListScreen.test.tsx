'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import type { NotificationItem } from '#store/slices/notificationSlice';
import { NotificationListScreen } from '../NotificationListScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/notifications/hooks/useNotifications', () => ({
  useNotifications: jest.fn(() => ({
    notifications: [],
    handleMarkAsRead: jest.fn(),
    handleMarkAllAsRead: jest.fn(),
    handleRemoveNotification: jest.fn(),
    clearAll: jest.fn(),
    getNotificationsByCategory: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('#features/notifications/hooks/useNotificationHistory', () => ({
  useNotificationHistory: jest.fn(() => ({
    loadMore: jest.fn(),
    hasMore: false,
    loadingMore: false,
    loading: false,
  })),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#features/notifications/components/NotificationItem', () => ({
  NotificationItem: () => null,
}));

jest.mock('#features/notifications/components/EmptyNotifications', () => ({
  EmptyNotifications: () => {
    const { Text } = require('react-native');
    return <Text>No notifications</Text>;
  },
}));

jest.mock('#features/notifications/components/NotificationHeader', () => ({
  NotificationHeader: ({ hasNotifications }: { hasNotifications: boolean }) => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>
          Header {hasNotifications ? 'with' : 'without'} notifications
        </Text>
      </View>
    );
  },
}));

jest.mock('#features/notifications/components/NotificationGroupHeader', () => ({
  NotificationGroupHeader: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('#features/notifications/components/NotificationFilters', () => ({
  NotificationFilters: () => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>Filters</Text>
      </View>
    );
  },
}));

jest.mock(
  '#features/notifications/components/UrgentNotificationsBanner',
  () => ({
    UrgentNotificationsBanner: () => null,
  }),
);

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: { title?: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock(
  '#features/notifications/components/NotificationActionHandler',
  () => ({
    NotificationActionHandler: ({
      children,
    }: {
      children: (props: {
        handleNotificationAction: () => void;
      }) => React.ReactNode;
    }) => children({ handleNotificationAction: jest.fn() }),
  }),
);

jest.mock('#utils/notificationGrouping', () => ({
  groupNotificationsByDate: jest
    .fn()
    .mockReturnValue({ urgent: [], today: [], earlier: [] }),
  createSectionListData: jest.fn().mockReturnValue([]),
}));

jest.mock('#store/slices/notificationSlice', () => ({
  // Spread the real slice so every export (NotificationPriority,
  // isNotificationPayload, MAX_NOTIFICATIONS, NOTIFICATION_CATEGORIES) stays
  // present — a partial factory would silently drop them.
  ...jest.requireActual('#store/slices/notificationSlice'),
  // The footer loader pulls themedComponents → IconButton → the real store,
  // whose index calls createNotificationSlice; provide a no-op so it builds.
  createNotificationSlice: () => ({}),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NotificationListScreen', () => {
  it('renders notifications title', () => {
    const { getByText } = render(<NotificationListScreen />);
    expect(getByText('Notifications')).toBeTruthy();
  });

  it('shows empty state when no notifications', () => {
    const { getByText } = render(<NotificationListScreen />);
    expect(getByText('No notifications')).toBeTruthy();
  });

  it('renders header', () => {
    const { getByText } = render(<NotificationListScreen />);
    expect(getByText('Header without notifications')).toBeTruthy();
  });

  it('renders filters', () => {
    const { getByText } = render(<NotificationListScreen />);
    expect(getByText('Filters')).toBeTruthy();
  });

  it('renders with notifications data', () => {
    const {
      groupNotificationsByDate,
      createSectionListData,
    } = require('#utils/notificationGrouping');
    groupNotificationsByDate.mockReturnValue({
      urgent: [],
      today: [
        {
          id: 'n1',
          title: 'Test',
          message: 'msg',
          category: 'PANTRY',
          isRead: false,
        },
      ],
      earlier: [],
    });
    createSectionListData.mockReturnValue([
      {
        title: 'Today',
        data: [
          {
            id: 'n1',
            title: 'Test',
            message: 'msg',
            category: 'PANTRY',
            isRead: false,
          },
        ],
      },
    ]);

    const { useNotifications } =
      require('#features/notifications/hooks/useNotifications') as typeof import('#features/notifications/hooks/useNotifications');
    type UseNotificationsReturn = ReturnType<typeof useNotifications>;
    const notifications = [
      {
        id: 'n1',
        title: 'Test',
        message: 'msg',
        category: 'PANTRY',
        isRead: false,
      },
    ] as Partial<NotificationItem>[] as NotificationItem[];
    jest.mocked(useNotifications).mockReturnValue({
      notifications,
      handleMarkAsRead: jest.fn(),
      handleMarkAllAsRead: jest.fn(),
      handleRemoveNotification: jest.fn(),
      clearAll: jest.fn(),
      getNotificationsByCategory: jest.fn().mockReturnValue([]),
    } as Partial<UseNotificationsReturn> as UseNotificationsReturn);

    const { getByText } = render(<NotificationListScreen />);
    expect(getByText('Today')).toBeTruthy();
  });
});

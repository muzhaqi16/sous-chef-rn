'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
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
  NotificationHeader: ({ hasNotifications }: any) => {
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
  NotificationGroupHeader: ({ title }: any) => {
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
  Header: ({ title }: any) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock(
  '#features/notifications/components/NotificationActionHandler',
  () => ({
    NotificationActionHandler: ({ children }: any) =>
      children({ handleNotificationAction: jest.fn() }),
  }),
);

jest.mock('#utils/notificationGrouping', () => ({
  groupNotificationsByDate: jest
    .fn()
    .mockReturnValue({ urgent: [], today: [], earlier: [] }),
  createSectionListData: jest.fn().mockReturnValue([]),
}));

jest.mock('#store/slices/notificationSlice', () => ({
  NOTIFICATION_CATEGORIES: ['HOME', 'PANTRY', 'RECIPE', 'SHOPPING', 'SYSTEM'],
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

    const {
      useNotifications,
    } = require('#features/notifications/hooks/useNotifications');
    jest.mocked(useNotifications).mockReturnValue({
      notifications: [
        {
          id: 'n1',
          title: 'Test',
          message: 'msg',
          category: 'PANTRY',
          isRead: false,
        },
      ],
      handleMarkAsRead: jest.fn(),
      handleMarkAllAsRead: jest.fn(),
      handleRemoveNotification: jest.fn(),
      clearAll: jest.fn(),
      getNotificationsByCategory: jest.fn().mockReturnValue([]),
    } as any);

    const { getByText } = render(<NotificationListScreen />);
    expect(getByText('Today')).toBeTruthy();
  });
});

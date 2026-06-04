'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NotificationType } from '#/graphql/generated/schemaTypes';
import { NotificationDetailScreen } from '../NotificationDetailScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
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
jest.mock('date-fns/format', () => ({
  format: () => 'Jan 1, 2026',
}));

type DetailRoute = React.ComponentProps<
  typeof NotificationDetailScreen
>['route'];

type DetailParams = DetailRoute['params'];

const makeRoute = (params: Partial<DetailParams> = {}): DetailRoute => ({
  params: params as DetailParams,
});

describe('NotificationDetailScreen', () => {
  it('shows error when notification is missing', () => {
    render(<NotificationDetailScreen route={makeRoute()} />);
    expect(screen.getByText('Notification not found')).toBeTruthy();
  });

  it('renders notification with expiry type', () => {
    const notification = {
      id: '1',
      type: NotificationType.ExpiryReminder,
      title: 'Items Expiring Soon',
      sentAt: '2026-01-01T00:00:00Z',
      message: 'Test message',
      payload: { message: 'Milk is expiring soon' },
      requiresAction: false,
    } as DetailParams['notification'];
    render(<NotificationDetailScreen route={makeRoute({ notification })} />);
    expect(screen.getByText('Items Expiring Soon')).toBeTruthy();
    expect(screen.getByText('Milk is expiring soon')).toBeTruthy();
  });

  it('renders notification with object payload', () => {
    const notification = {
      id: '2',
      type: NotificationType.LowStock,
      title: 'Low Stock Alert',
      sentAt: '2026-01-01T00:00:00Z',
      message: 'Stock alert',
      payload: { message: 'Low stock detected' },
      requiresAction: false,
    } as DetailParams['notification'];
    render(<NotificationDetailScreen route={makeRoute({ notification })} />);
    expect(screen.getByText('Low Stock Alert')).toBeTruthy();
    expect(screen.getByText('Low stock detected')).toBeTruthy();
  });
});

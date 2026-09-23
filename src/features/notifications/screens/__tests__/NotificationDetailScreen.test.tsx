'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  toDisplayNotification,
  type DisplayNotification,
} from '#features/notifications/utils/toDisplayNotification';
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

// The server's English rides along on the fragment, as it does on the wire.
const makeNotification = (
  type: NotificationType,
  payload: Record<string, unknown>,
  server: { title: string; message: string },
): DisplayNotification =>
  toDisplayNotification({
    __typename: 'Notification',
    id: 'n-1',
    type,
    isAuthoredContent: false,
    status: NotificationStatus.Sent,
    priority: Priority.Normal,
    title: server.title,
    message: server.message,
    payload,
    category: NotificationCategory.Pantry,
    sentAt: '2026-01-01T00:00:00Z',
    expiresAt: null,
    sourceId: null,
    sourceType: null,
    actionUrl: null,
    readAt: null,
  });

describe('NotificationDetailScreen', () => {
  it('shows error when notification is missing', () => {
    render(<NotificationDetailScreen route={makeRoute()} />);
    expect(screen.getByText('Notification not found')).toBeTruthy();
  });

  it('renders an expiry reminder from its payload', () => {
    const server = {
      title: 'Expiration Reminder',
      message: 'Milk expires in 2 days (Mar 3)',
    };
    const notification = makeNotification(
      NotificationType.ExpiryReminder,
      { itemName: 'Milk', daysUntilExpiry: 1 },
      server,
    );
    render(<NotificationDetailScreen route={makeRoute({ notification })} />);
    expect(screen.getByText('Expiry reminder')).toBeTruthy();
    expect(screen.getByText('Milk: Expires tomorrow')).toBeTruthy();
    expect(screen.queryByText(server.title)).toBeNull();
    expect(screen.queryByText(server.message)).toBeNull();
  });

  it('renders a low-stock alert from its payload', () => {
    const server = {
      title: 'Low Stock Alert',
      message: 'Rice is running low (2 remaining)',
    };
    const notification = makeNotification(
      NotificationType.LowStock,
      { itemName: 'Rice', currentQuantity: 2, minQuantity: 5 },
      server,
    );
    render(<NotificationDetailScreen route={makeRoute({ notification })} />);
    expect(screen.getByText('Low stock')).toBeTruthy();
    expect(screen.getByText('Rice is running low (2 left)')).toBeTruthy();
    expect(screen.queryByText(server.title)).toBeNull();
    expect(screen.queryByText(server.message)).toBeNull();
  });

  it('falls back to generic copy, not the server text, when the payload has no names', () => {
    const server = {
      title: 'Announcement',
      message: 'A message an administrator typed',
    };
    const notification = makeNotification(
      NotificationType.ListUpdated,
      {},
      server,
    );
    render(<NotificationDetailScreen route={makeRoute({ notification })} />);
    expect(screen.getByText('Shopping list updated')).toBeTruthy();
    expect(screen.getByText('A shared shopping list has changes')).toBeTruthy();
    expect(screen.queryByText(server.message)).toBeNull();
  });
});

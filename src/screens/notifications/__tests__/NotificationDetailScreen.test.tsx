'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NotificationDetailScreen } from '../NotificationDetailScreen';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#components/notifications/NotificationActionHandler', () => ({
  NotificationActionHandler: ({ children }: any) =>
    children({ handleNotificationAction: jest.fn() }),
}));
jest.mock('date-fns/format', () => ({
  format: () => 'Jan 1, 2026',
}));

describe('NotificationDetailScreen', () => {
  it('shows error when notification is missing', () => {
    render(
      <NotificationDetailScreen route={{ params: {} } as any} />,
    );
    expect(screen.getByText('Notification not found')).toBeTruthy();
  });

  it('renders notification with expiry type', () => {
    const notification = {
      id: '1',
      type: 'EXPIRY_REMINDER',
      sentAt: '2026-01-01T00:00:00Z',
      message: 'Test message',
      payload: JSON.stringify({ message: 'Milk is expiring soon' }),
      requiresAction: false,
    };
    render(
      <NotificationDetailScreen route={{ params: { notification } } as any} />,
    );
    expect(screen.getByText('Item Expiring Soon')).toBeTruthy();
    expect(screen.getByText('Milk is expiring soon')).toBeTruthy();
  });

  it('renders notification with object payload', () => {
    const notification = {
      id: '2',
      type: 'LOW_STOCK',
      sentAt: '2026-01-01T00:00:00Z',
      message: 'Stock alert',
      payload: { message: 'Low stock detected' },
      requiresAction: false,
    };
    render(
      <NotificationDetailScreen route={{ params: { notification } } as any} />,
    );
    expect(screen.getByText('Low Stock Alert')).toBeTruthy();
    expect(screen.getByText('Low stock detected')).toBeTruthy();
  });
});

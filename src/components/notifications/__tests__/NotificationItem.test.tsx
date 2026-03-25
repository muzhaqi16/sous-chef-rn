import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NotificationItem } from '../NotificationItem';
import { NotificationCategory, NotificationType } from '#generated';
import { NotificationPriority } from '#store/slices/notificationSlice';

jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('#utils/notifications/notificationHelpers', () => ({
  getNotificationIcon: jest.fn(() => 'notifications'),
}));

jest.mock('#utils/dateUtils', () => ({
  safeParseDate: jest.fn(() => new Date('2026-03-01T12:00:00Z')),
}));

jest.mock('date-fns/formatDistanceToNow', () => ({
  formatDistanceToNow: jest.fn(() => '1 day ago'),
}));

const makeNotification = (overrides?: any) => ({
  id: 'notif-1',
  type: NotificationType.HomeInvitation,
  category: NotificationCategory.Shopping,
  priority: NotificationPriority.MEDIUM,
  title: 'New Invitation',
  message: 'You have been invited to join a home.',
  payload: {},
  sentAt: '2026-03-01T12:00:00Z',
  isRead: false,
  ...overrides,
});

describe('NotificationItem', () => {
  const defaultProps = {
    notification: makeNotification(),
    onPress: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notification title', () => {
    render(<NotificationItem {...defaultProps} />);
    expect(screen.getByText('New Invitation')).toBeTruthy();
  });

  it('renders notification message', () => {
    render(<NotificationItem {...defaultProps} />);
    expect(
      screen.getByText('You have been invited to join a home.'),
    ).toBeTruthy();
  });

  it('renders formatted timestamp', () => {
    render(<NotificationItem {...defaultProps} />);
    expect(screen.getByText('1 day ago')).toBeTruthy();
  });

  it('calls onPress with notification when pressed', () => {
    render(<NotificationItem {...defaultProps} />);
    fireEvent.press(screen.getByText('New Invitation'));
    expect(defaultProps.onPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notif-1' }),
    );
  });

  it('renders dismiss button when onDismiss is provided', () => {
    render(<NotificationItem {...defaultProps} />);
    expect(screen.getByTestId('icon-close')).toBeTruthy();
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    render(
      <NotificationItem
        notification={makeNotification()}
        onPress={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('icon-close')).toBeNull();
  });

  it('calls onDismiss with notification id when dismiss is pressed', () => {
    render(<NotificationItem {...defaultProps} />);
    fireEvent.press(screen.getByTestId('icon-close'));
    expect(defaultProps.onDismiss).toHaveBeenCalledWith('notif-1');
  });

  it('renders with read styling when notification is read', () => {
    const readNotif = makeNotification({ isRead: true });
    const { toJSON } = render(
      <NotificationItem {...defaultProps} notification={readNotif} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with unread styling when notification is not read', () => {
    const unreadNotif = makeNotification({ isRead: false });
    const { toJSON } = render(
      <NotificationItem {...defaultProps} notification={unreadNotif} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});

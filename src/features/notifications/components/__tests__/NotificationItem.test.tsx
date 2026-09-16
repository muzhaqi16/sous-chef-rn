import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { NotificationItem } from '../NotificationItem';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  toDisplayNotification,
  type DisplayNotification as NotificationItemData,
} from '#features/notifications/utils/toDisplayNotification';

jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('#utils/dateUtils', () => ({
  safeParseDate: jest.fn(() => new Date('2026-03-01T12:00:00Z')),
}));

jest.mock('date-fns/formatDistanceToNow', () => ({
  formatDistanceToNow: jest.fn(() => '1 day ago'),
}));

// The server's English title and message ride along, as they do on the wire.
const SERVER_TITLE = 'You have a new Home Invitation';
const SERVER_MESSAGE = 'Alice invited you to join "The Smiths"';

const makeNotification = (
  overrides?: Partial<NotificationItemData>,
): NotificationItemData => ({
  ...toDisplayNotification({
    __typename: 'Notification',
    id: 'notif-1',
    type: NotificationType.HomeInvitation,
    isAuthoredContent: false,
    status: NotificationStatus.Sent,
    priority: Priority.Normal,
    title: SERVER_TITLE,
    message: SERVER_MESSAGE,
    payload: { inviterName: 'Alice', homeName: 'The Smiths' },
    category: NotificationCategory.Home,
    sentAt: '2026-03-01T12:00:00Z',
    expiresAt: null,
    sourceId: null,
    sourceType: null,
    actionUrl: null,
    readAt: null,
  }),
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

  it('renders the title built from the notification type', () => {
    render(<NotificationItem {...defaultProps} />);
    expect(screen.getByText('Home invitation')).toBeTruthy();
  });

  it('renders the message built from the payload names', () => {
    render(<NotificationItem {...defaultProps} />);
    expect(
      screen.getByText('Alice invited you to join The Smiths'),
    ).toBeTruthy();
  });

  it("never renders the server's English title or message", () => {
    render(<NotificationItem {...defaultProps} />);
    expect(screen.queryByText(SERVER_TITLE)).toBeNull();
    expect(screen.queryByText(SERVER_MESSAGE)).toBeNull();
  });

  it('renders formatted timestamp', () => {
    render(<NotificationItem {...defaultProps} />);
    expect(screen.getByText('1 day ago')).toBeTruthy();
  });

  it('calls onPress with notification when pressed', async () => {
    const user = userEvent.setup();
    render(<NotificationItem {...defaultProps} />);
    await user.press(screen.getByText('Home invitation'));
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

  it('calls onDismiss with notification id when dismiss is pressed', async () => {
    const user = userEvent.setup();
    render(<NotificationItem {...defaultProps} />);
    await user.press(screen.getByTestId('icon-close'));
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

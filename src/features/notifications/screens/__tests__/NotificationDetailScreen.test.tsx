'use no memo';
import React from 'react';
import { act, screen, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { t } from '#/i18n';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from '#features/notifications/hooks/useNotificationsOnLaunch.generated';
import {
  toDisplayNotification,
  type DisplayNotification,
} from '#features/notifications/utils/toDisplayNotification';
import { NotificationDetailScreen } from '../NotificationDetailScreen';

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

type ServerRow = UseNotificationsOnLaunch_NotificationFragment;

const makeRoute = (params: Partial<DetailParams> = {}): DetailRoute => ({
  params: params as DetailParams,
});

/** The row as the server sends it; the feed reads it through this fragment. */
const serverRow = (overrides: Partial<ServerRow>): ServerRow => ({
  __typename: 'Notification',
  id: 'n-1',
  type: NotificationType.ListUpdated,
  isAuthoredContent: false,
  status: NotificationStatus.Sent,
  priority: Priority.Normal,
  title: null,
  message: null,
  payload: {},
  category: NotificationCategory.Pantry,
  sentAt: '2026-01-01T00:00:00Z',
  expiresAt: null,
  sourceId: null,
  sourceType: null,
  pantryItemId: null,
  actionUrl: null,
  readAt: null,
  ...overrides,
});

// The server's English rides along on the fragment, as it does on the wire.
const makeNotification = (
  type: NotificationType,
  payload: Record<string, unknown>,
  server: { title: string; message: string },
): DisplayNotification =>
  toDisplayNotification(serverRow({ type, payload, ...server }));

describe('NotificationDetailScreen', () => {
  it('shows error when notification is missing', () => {
    renderWithApollo(<NotificationDetailScreen route={makeRoute()} />);
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
    renderWithApollo(
      <NotificationDetailScreen route={makeRoute({ notification })} />,
    );
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
    renderWithApollo(
      <NotificationDetailScreen route={makeRoute({ notification })} />,
    );
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
    renderWithApollo(
      <NotificationDetailScreen route={makeRoute({ notification })} />,
    );
    expect(screen.getByText('Shopping list updated')).toBeTruthy();
    expect(screen.getByText('A shared shopping list has changes')).toBeTruthy();
    expect(screen.queryByText(server.message)).toBeNull();
  });

  describe("an expiry reminder's stack action", () => {
    const takeAction = t('notifications.takeAction');

    // The payload keeps the stack as it was when the reminder was written; only
    // `pantryItemId` says what the server names now.
    const reminder = (pantryItemId: string | null) =>
      serverRow({
        type: NotificationType.ExpiryReminder,
        payload: { itemName: 'Milk', daysUntilExpiry: 1, pantryItemId: 's-1' },
        pantryItemId,
      });

    const openedOn = (row: ServerRow) =>
      makeRoute({ id: row.id, notification: toDisplayNotification(row) });

    it('is offered while the server names the stack', () => {
      renderWithApollo(
        <NotificationDetailScreen route={openedOn(reminder('s-1'))} />,
      );
      expect(screen.getByText(takeAction)).toBeTruthy();
    });

    it('is not offered, and no error is shown, when the server names no stack', () => {
      renderWithApollo(
        <NotificationDetailScreen route={openedOn(reminder(null))} />,
      );
      expect(screen.getByText('Milk: Expires tomorrow')).toBeTruthy();
      expect(screen.queryByText(takeAction)).toBeNull();
      expect(screen.queryByText(t('notifications.notFound'))).toBeNull();
    });

    // The route carries the row as it was when the screen opened; the cache
    // carries what the server says now.
    it('is withdrawn when the server stops naming the stack while the screen is open', async () => {
      const cache = makeCache();
      const write = (row: ServerRow) =>
        cache.writeFragment({
          fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
          fragmentName: 'useNotificationsOnLaunch_notification',
          data: row,
        });
      write(reminder('s-1'));
      renderWithApollo(
        <NotificationDetailScreen route={openedOn(reminder('s-1'))} />,
        { cache },
      );
      expect(screen.getByText(takeAction)).toBeTruthy();

      act(() => {
        write(reminder(null));
      });

      await waitFor(() => expect(screen.queryByText(takeAction)).toBeNull());
      expect(screen.getByText('Milk: Expires tomorrow')).toBeTruthy();
    });
  });
});

'use no memo';
import React, { useEffect } from 'react';
import { act, waitFor } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import {
  recordMock,
  renderWithApollo,
  seedCache,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { MarkExpirationActionDocument } from '#features/notifications/graphql/expirationNotificationMutations.generated';
import { MarkNotificationAsReadDocument } from '#features/notifications/graphql/notificationMutations.generated';
import { NotificationSummaryDocument } from '#features/notifications/graphql/notifications.generated';
import {
  ExpirationAction,
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { todayKey } from '#/utils/dateUtils';
import { readNotificationStatus } from '#features/notifications/utils/notificationCacheWrites';
import type { DisplayNotification } from '#features/notifications/utils/toDisplayNotification';
import { NotificationActionHandler } from '../NotificationActionHandler';

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T,>(
    selector: (state: { setHomeAndPantry: jest.Mock }) => T,
  ): T => selector({ setHomeAndPantry: jest.fn() }),
}));

jest.mock(
  '#features/notifications/components/InvitationAcceptanceModal',
  () => ({
    InvitationAcceptanceModal: () => null,
  }),
);

type OnActionSelected = (
  notification: DisplayNotification,
  action: ExpirationAction,
) => void;
let mockOnActionSelected: OnActionSelected | undefined;
jest.mock('#features/notifications/components/ExpirationActionSheet', () => ({
  ExpirationActionSheet: ({
    onActionSelected,
  }: {
    onActionSelected: OnActionSelected;
  }) => {
    mockOnActionSelected = onActionSelected;
    return null;
  },
}));

/** Every mutation the client was handed, by operation name, in order. */
let sentMutations: () => string[] = () => [];

/**
 * Watches the client itself, below every hook: a recorded mock only shows that
 * its own operation fired, never that nothing else did.
 */
function MutationProbe() {
  const client = useApolloClient();
  useEffect(() => {
    const spy = jest.spyOn(client, 'mutate');
    sentMutations = () =>
      spy.mock.calls.map(([options]) => operationNameOf(options.mutation));
    return () => spy.mockRestore();
  }, [client]);
  return null;
}

/** The unread feed notification `n1` and the badge that counts it. */
function seedFeed(unreadCount: number): InMemoryCache {
  const cache = seedCache([
    {
      __typename: 'Notification',
      id: 'n1',
      status: NotificationStatus.Sent,
      title: 'Seeded',
      message: 'Seeded message',
      type: NotificationType.ExpiryReminder,
      category: NotificationCategory.Pantry,
      priority: Priority.Normal,
      payload: null,
      actionUrl: null,
      sourceId: 'stack-1',
      sourceType: 'PANTRY_ITEM',
      pantryItemId: 'stack-1',
      sentAt: '2026-01-01T00:00:00.000Z',
      readAt: null,
      expiresAt: null,
      isAuthoredContent: false,
    },
  ]);
  seedQuery(cache, {
    query: NotificationSummaryDocument,
    data: {
      __typename: 'Query',
      notificationSummary: {
        __typename: 'NotificationSummary',
        id: 'user-1',
        unreadCount,
        hasUrgent: false,
      },
    },
  });
  return cache;
}

const readBadge = (cache: InMemoryCache) =>
  cache.readQuery({ query: NotificationSummaryDocument })?.notificationSummary
    .unreadCount;

const linkedReminder: DisplayNotification = {
  id: 'n1',
  type: NotificationType.ExpiryReminder,
  isAuthoredContent: false,
  category: NotificationCategory.Pantry,
  priority: Priority.Normal,
  data: null,
  isTest: false,
  details: null,
  pantryItemId: 'stack-1',
  sentAt: '2026-01-01T00:00:00.000Z',
  isRead: false,
  requiresAction: true,
  actionType: 'VIEW_EXPIRING_ITEMS',
  expirationNotificationId: 'exp-1',
};

const actionAnswer = () =>
  recordMock(MarkExpirationActionDocument, {
    data: {
      markExpirationAction: {
        __typename: 'MarkExpirationActionPayload',
        expirationNotification: {
          __typename: 'ExpirationNotification',
          id: 'exp-1',
        },
      },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockOnActionSelected = undefined;
  sentMutations = () => [];
});

describe('NotificationActionHandler — acting on an expiry notification', () => {
  it('sends the action and one mark-read, and shows the badge that mark-read states', async () => {
    const cache = seedFeed(3);
    const action = actionAnswer();
    // No local delta takes 3 to 7: only the response can state it.
    const markRead = recordMock(MarkNotificationAsReadDocument, {
      data: {
        markNotificationAsRead: {
          __typename: 'MarkNotificationAsReadPayload',
          notification: {
            __typename: 'Notification',
            id: 'n1',
            status: NotificationStatus.Read,
          },
          notificationSummary: {
            __typename: 'NotificationSummary',
            id: 'user-1',
            unreadCount: 7,
            hasUrgent: false,
          },
        },
      },
    });
    renderWithApollo(
      <NotificationActionHandler>
        {() => <MutationProbe />}
      </NotificationActionHandler>,
      { cache, operationMocks: [action.mock, markRead.mock] },
    );

    act(() =>
      mockOnActionSelected?.(linkedReminder, ExpirationAction.Consumed),
    );

    // The notification reads at once, on the local write.
    expect(readNotificationStatus(cache, 'n1')).toBe(NotificationStatus.Read);
    await waitFor(() => expect(readBadge(cache)).toBe(7));

    expect(action.fired).toEqual([
      {
        input: { notificationId: 'exp-1', action: ExpirationAction.Consumed },
        today: todayKey(),
      },
    ]);
    expect(markRead.fired).toEqual([{ input: { id: 'n1' } }]);
    // The reminder gets no write of its own: the server reads it with `n1`.
    expect(sentMutations()).toEqual([
      operationNameOf(MarkExpirationActionDocument),
      operationNameOf(MarkNotificationAsReadDocument),
    ]);
    expect(readNotificationStatus(cache, 'n1')).toBe(NotificationStatus.Read);
  });

  it('sends only the action for a notification already read', async () => {
    const cache = seedFeed(3);
    cache.modify({
      id: cache.identify({ __typename: 'Notification', id: 'n1' }),
      fields: { status: () => NotificationStatus.Read },
    });
    const action = actionAnswer();
    renderWithApollo(
      <NotificationActionHandler>
        {() => <MutationProbe />}
      </NotificationActionHandler>,
      { cache, operationMocks: [action.mock] },
    );

    act(() =>
      mockOnActionSelected?.(
        { ...linkedReminder, isRead: true },
        ExpirationAction.Waste,
      ),
    );

    await waitFor(() => expect(action.fired).toHaveLength(1));
    expect(sentMutations()).toEqual([
      operationNameOf(MarkExpirationActionDocument),
    ]);
    expect(readBadge(cache)).toBe(3);
  });

  it('sends nothing for a notification with no linked reminder', () => {
    renderWithApollo(
      <NotificationActionHandler>
        {() => <MutationProbe />}
      </NotificationActionHandler>,
      { cache: seedFeed(3) },
    );

    act(() =>
      mockOnActionSelected?.(
        { ...linkedReminder, expirationNotificationId: undefined },
        ExpirationAction.Consumed,
      ),
    );

    expect(sentMutations()).toEqual([]);
  });
});

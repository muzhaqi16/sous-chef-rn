import { act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import { MarkExpirationActionDocument } from '#features/notifications/graphql/expirationNotificationMutations.generated';
import { NotificationSummaryDocument } from '#features/notifications/graphql/notifications.generated';
import {
  ExpirationAction,
  NotificationStatus,
  NotificationType,
} from '#/graphql/generated/schemaTypes';
import { readNotificationStatus } from '#features/notifications/utils/notificationCacheWrites';
import { useExpirationNotificationSync } from '../useExpirationNotificationSync';

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn() },
}));

/** An unread generic notification and the badge that counts it. */
function seedFeed(unreadCount: number): InMemoryCache {
  const cache = seedCache([
    {
      __typename: 'Notification',
      id: 'n1',
      status: NotificationStatus.Sent,
      title: 'Seeded',
      message: 'Seeded message',
      type: NotificationType.ExpiryReminder,
      category: 'PANTRY',
      priority: 'NORMAL',
      payload: null,
      actionUrl: null,
      sourceId: null,
      sourceType: null,
      sentAt: '2026-01-01T00:00:00.000Z',
      readAt: null,
      expiresAt: null,
      isAuthoredContent: false,
    },
  ]);
  cache.writeQuery({
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

const markActionAnswer: MockFor<typeof MarkExpirationActionDocument> = {
  request: { query: MarkExpirationActionDocument, variables: () => true },
  result: {
    data: {
      markExpirationAction: {
        __typename: 'MarkExpirationActionPayload',
        expirationNotification: {
          __typename: 'ExpirationNotification',
          id: 'exp-1',
        },
      },
    },
  },
};

describe('useExpirationNotificationSync — syncMarkAction', () => {
  it('leaves the badge and the generic row to the service, which never moves them', async () => {
    const cache = seedFeed(3);
    const { result } = renderHookWithApollo(
      () => useExpirationNotificationSync(),
      { cache, operationMocks: [markActionAnswer] },
    );

    await act(async () => {
      await result.current.syncMarkAction(
        'n1',
        'exp-1',
        ExpirationAction.Consumed,
      );
    });

    expect(
      cache.readQuery({ query: NotificationSummaryDocument })
        ?.notificationSummary.unreadCount,
    ).toBe(3);
    expect(readNotificationStatus(cache, 'n1')).toBe(NotificationStatus.Sent);
  });
});

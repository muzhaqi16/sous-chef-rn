import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { NotificationStatus } from '#/graphql/generated/schemaTypes';
import { useNotificationHistory } from '../useNotificationHistory';

jest.mock('#/apollo/links/tokenScheduler');

describe('useNotificationHistory', () => {
  // Marking one read edits only that notification, so the feed query's result
  // stays the same object.
  it('shows a notification read once its own status changes', async () => {
    const cache = makeCache();
    const get = recordMock(GetNotificationsDocument, {
      data: {
        me: {
          __typename: 'User',
          id: 'u1',
          notificationsConnection: {
            edges: [
              { node: { id: 'n1', status: NotificationStatus.Sent } },
              { node: { id: 'n2', status: NotificationStatus.Sent } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useNotificationHistory(null, true),
      { operationMocks: [get.mock], cache },
    );
    await waitFor(() =>
      expect(result.current.notifications.map(n => n.isRead)).toEqual([
        false,
        false,
      ]),
    );

    await act(async () => {
      cache.modify({
        id: cache.identify({ __typename: 'Notification', id: 'n2' }),
        fields: {
          status: () => NotificationStatus.Read,
          readAt: () => '2025-01-02T00:00:00Z',
        },
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.notifications.map(n => n.isRead)).toEqual([
        false,
        true,
      ]),
    );
  });
});

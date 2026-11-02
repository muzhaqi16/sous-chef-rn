import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import { GetNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  NotificationCategory,
  NotificationStatus,
} from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { useNotificationHistory } from '../useNotificationHistory';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useNotificationHistory offline', () => {
  it('shows the held rows of a category never loaded', async () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    const feed = recordMock(GetNotificationsDocument, {
      data: {
        me: {
          __typename: 'User',
          id: 'u1',
          notificationsConnection: {
            edges: [
              { node: { id: 'n1', category: NotificationCategory.Pantry } },
              { node: { id: 'n2', category: NotificationCategory.Shopping } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useNotificationHistory(NotificationCategory.Shopping, true),
      { operationMocks: [feed.mock] },
    );
    await drainTimers();
    useStore.setState({ isOnline: true, apiReachable: null });

    expect(feed.fired[0]).toEqual({ filter: undefined, first: 30 });
    expect(result.current.notifications.map(n => n.id)).toEqual(['n2']);
    expect(result.current.mayHoldMore).toBe(false);
  });

  it('says the feed may hold more of a category while pages remain', async () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    const feed = recordMock(GetNotificationsDocument, {
      data: {
        me: {
          __typename: 'User',
          id: 'u1',
          notificationsConnection: {
            edges: [
              { node: { id: 'n1', category: NotificationCategory.Pantry } },
            ],
            pageInfo: { hasNextPage: true, endCursor: 'c1' },
          },
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useNotificationHistory(NotificationCategory.Shopping, true),
      { operationMocks: [feed.mock] },
    );
    await drainTimers();
    useStore.setState({ isOnline: true, apiReachable: null });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.mayHoldMore).toBe(true);
  });
});

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
    await drainTimers();
    expect(result.current.notifications.map(n => n.isRead)).toEqual([
      false,
      false,
    ]);

    await drained(async () => {
      cache.modify({
        id: cache.identify({ __typename: 'Notification', id: 'n2' }),
        fields: {
          status: () => NotificationStatus.Read,
          readAt: () => '2025-01-02T00:00:00Z',
        },
      });
      await Promise.resolve();
    });
    expect(result.current.notifications.map(n => n.isRead)).toEqual([
      false,
      true,
    ]);
  });
});

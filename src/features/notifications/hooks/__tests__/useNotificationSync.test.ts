import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import type { InMemoryCache } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  MarkNotificationAsReadDocument,
  MarkNotificationUnreadDocument,
  DeleteNotificationDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import { MarkAllNotificationsAsReadDocument } from '#features/notifications/graphql/bulkNotificationMutations.generated';
import { NotificationStatus } from '#/graphql/generated/schemaTypes';
import { readNotificationStatus } from '#features/notifications/utils/notificationCacheWrites';
import { useNotificationSync } from '../useNotificationSync';

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

// The hook reads only the signed-in user from the store now — whether a
// notification is unread is read from the cache, which is also what renders
// it, so the two can no longer disagree.
let mockUser: { id: string } | null = { id: 'user-1' };
jest.mock('#store', () => ({
  useStore: {
    getState: () => ({ user: mockUser }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'user-1' };
});

const BADGE_FRAGMENT = gql`
  fragment _TestBadge on User {
    unreadNotificationCount
    hasUrgentNotifications
  }
`;

/**
 * A cache holding the badge and the rows it counts.
 *
 * The rows are what changed: the hook used to ask a Zustand mirror whether a
 * notification was unread, and now asks the cache the list renders from.
 */
const seedFeed = (
  unreadNotificationCount: number,
  rows: Array<{ id: string; status: NotificationStatus }> = [],
  hasUrgentNotifications = true,
) =>
  seedCache([
    {
      __typename: 'User',
      id: 'user-1',
      unreadNotificationCount,
      hasUrgentNotifications,
    },
    ...rows.map(r => ({
      __typename: 'Notification',
      id: r.id,
      status: r.status,
    })),
  ]);

const UNREAD = NotificationStatus.Sent;
const READ = NotificationStatus.Read;

const readBadge = (cache: InMemoryCache) =>
  cache.readFragment<{
    unreadNotificationCount: number;
    hasUrgentNotifications: boolean;
  }>({ id: 'User:user-1', fragment: BADGE_FRAGMENT });

const markReadMock = (
  outcome: 'success' | 'not-found' = 'success',
): MockedResponse => ({
  request: { query: MarkNotificationAsReadDocument, variables: () => true },
  result: {
    data: {
      markNotificationAsRead:
        outcome === 'success'
          ? {
              __typename: 'MarkNotificationAsReadPayload',
              notification: {
                __typename: 'Notification',
                id: 'n1',
                status: 'READ',
              },
            }
          : {
              __typename: 'NotFoundError',
              code: 'NOT_FOUND',
              message: 'gone',
              resource: 'Notification',
              resourceId: 'n1',
            },
    },
  },
});

const markUnreadMock = (): MockedResponse => ({
  request: { query: MarkNotificationUnreadDocument, variables: () => true },
  result: {
    data: {
      markNotificationUnread: {
        __typename: 'MarkNotificationUnreadPayload',
        notification: {
          __typename: 'Notification',
          id: 'n1',
          status: 'UNREAD',
        },
      },
    },
  },
});

const deleteMock = (): MockedResponse => ({
  request: { query: DeleteNotificationDocument, variables: () => true },
  result: {
    data: {
      deleteNotification: {
        __typename: 'DeleteNotificationPayload',
        notification: { __typename: 'Notification', id: 'n1' },
      },
    },
  },
});

const markAllMock = (): MockedResponse => ({
  request: { query: MarkAllNotificationsAsReadDocument, variables: () => true },
  result: {
    data: {
      markAllNotificationsAsRead: {
        __typename: 'MarkAllNotificationsAsReadPayload',
        summary: { __typename: 'BulkNotificationSummary', total: 3 },
      },
    },
  },
});

const renderSync = (cache: InMemoryCache, operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useNotificationSync(), { cache, operationMocks });

describe('useNotificationSync — cached badge aggregates', () => {
  it('mark-read of an unread notification moves the row and the badge', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadMock()]);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    await waitFor(() =>
      expect(readBadge(cache)?.unreadNotificationCount).toBe(4),
    );
    expect(readNotificationStatus(cache, 'n1')).toBe(READ);
    expect(readBadge(cache)?.hasUrgentNotifications).toBe(true);
  });

  it('mark-read of an already-read notification fires nothing and adjusts nothing', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: READ }]);
    const { result } = renderSync(cache, []);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });

  it('mark-unread of a read notification increments the cached count', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: READ }]);
    const { result } = renderSync(cache, [markUnreadMock()]);

    await act(async () => {
      result.current.syncMarkUnread('n1');
    });

    await waitFor(() =>
      expect(readBadge(cache)?.unreadNotificationCount).toBe(6),
    );
    expect(readNotificationStatus(cache, 'n1')).toBe(UNREAD);
  });

  it('mark-unread of an already-unread notification fires nothing', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, []);

    await act(async () => {
      result.current.syncMarkUnread('n1');
    });

    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });

  it('deleting an unread notification decrements; deleting a read one does not', async () => {
    const cache = seedFeed(5, [
      { id: 'n1', status: UNREAD },
      { id: 'n2', status: READ },
    ]);
    const { result } = renderSync(cache, [deleteMock(), deleteMock()]);

    await act(async () => {
      result.current.syncDelete('n1');
    });
    await waitFor(() =>
      expect(readBadge(cache)?.unreadNotificationCount).toBe(4),
    );

    await act(async () => {
      result.current.syncDelete('n2');
    });
    await waitFor(() =>
      expect(readNotificationStatus(cache, 'n2')).toBeUndefined(),
    );
    // Second delete resolved too — the count must still reflect only the
    // unread removal.
    expect(readBadge(cache)?.unreadNotificationCount).toBe(4);
  });

  it('mark-all-read zeroes the count, clears the urgent flag and flips the rows', async () => {
    const cache = seedFeed(5, [
      { id: 'n1', status: UNREAD },
      { id: 'n2', status: READ },
    ]);
    const { result } = renderSync(cache, [markAllMock()]);

    await act(async () => {
      result.current.syncMarkAllAsRead();
    });

    await waitFor(() =>
      expect(readBadge(cache)).toEqual({
        __typename: 'User',
        unreadNotificationCount: 0,
        hasUrgentNotifications: false,
      }),
    );
    // The mutation returns a summary count and no ids, so the rows have to be
    // found locally or the list would not move at all.
    expect(readNotificationStatus(cache, 'n1')).toBe(READ);
  });

  // The refusal arrives as a RESOLVED result carrying an error-union member,
  // not as a throw — so the rollback has to read the result, not sit in a
  // catch that never runs.
  it('an error-union payload puts the row and the badge back', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadMock('not-found')]);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    await waitFor(() =>
      expect(readNotificationStatus(cache, 'n1')).toBe(UNREAD),
    );
    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });

  it('clamps at zero when the cached count is already stale-low', async () => {
    const cache = seedFeed(0, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadMock()]);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    await waitFor(() => expect(readNotificationStatus(cache, 'n1')).toBe(READ));
    expect(readBadge(cache)?.unreadNotificationCount).toBe(0);
  });

  it('no-ops without throwing when no user id is in scope', async () => {
    mockUser = null;
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadMock()]);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    // The row still moves — it is identified by its own id. Only the badge,
    // which hangs off the User entity, has nowhere to be written.
    await waitFor(() => expect(readNotificationStatus(cache, 'n1')).toBe(READ));
    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });
});

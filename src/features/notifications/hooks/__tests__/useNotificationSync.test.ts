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
import { useNotificationSync } from '../useNotificationSync';

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

// The hook reads notifications/user/actions via useStore.getState(). Mutable
// so each test controls the pre-mutation local state the deltas derive from.
let mockNotifications: Array<{ id: string; isRead: boolean }> = [];
let mockUser: { id: string } | null = { id: 'user-1' };
const mockStoreActions = {
  markAsRead: jest.fn(),
  markAsUnread: jest.fn(),
  removeNotification: jest.fn(),
  addNotification: jest.fn(),
  markAllAsRead: jest.fn(),
  updateUnreadCount: jest.fn(),
};
jest.mock('#store', () => ({
  useStore: {
    getState: () => ({
      notifications: mockNotifications,
      user: mockUser,
      ...mockStoreActions,
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockNotifications = [];
  mockUser = { id: 'user-1' };
});

const BADGE_FRAGMENT = gql`
  fragment _TestBadge on User {
    unreadNotificationCount
    hasUrgentNotifications
  }
`;

const seedBadge = (
  unreadNotificationCount: number,
  hasUrgentNotifications = true,
) =>
  seedCache([
    {
      __typename: 'User',
      id: 'user-1',
      unreadNotificationCount,
      hasUrgentNotifications,
    },
  ]);

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
  it('mark-read of an unread notification decrements the cached count (seed-effect regression)', async () => {
    // The clobber this guards against: the mutation response writes
    // Notification.status, re-broadcasting the watched notification queries;
    // the badge seed in useNotificationHistory then re-applies the CACHED
    // Me.unreadNotificationCount. This asserts that cached value is already
    // N−1 by then, so the re-seed can never bounce the badge back to N.
    mockNotifications = [{ id: 'n1', isRead: false }];
    const cache = seedBadge(5);
    const { result } = renderSync(cache, [markReadMock()]);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    await waitFor(() =>
      expect(readBadge(cache)?.unreadNotificationCount).toBe(4),
    );
    expect(readBadge(cache)?.hasUrgentNotifications).toBe(true);
    expect(mockStoreActions.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('mark-read of an already-read notification fires nothing and adjusts nothing', async () => {
    mockNotifications = [{ id: 'n1', isRead: true }];
    const cache = seedBadge(5);
    const { result } = renderSync(cache, []);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
    expect(mockStoreActions.markAsRead).not.toHaveBeenCalled();
  });

  it('mark-unread of a read notification increments the cached count', async () => {
    mockNotifications = [{ id: 'n1', isRead: true }];
    const cache = seedBadge(5);
    const { result } = renderSync(cache, [markUnreadMock()]);

    await act(async () => {
      result.current.syncMarkUnread('n1');
    });

    await waitFor(() =>
      expect(readBadge(cache)?.unreadNotificationCount).toBe(6),
    );
  });

  it('mark-unread of an already-unread notification fires nothing', async () => {
    mockNotifications = [{ id: 'n1', isRead: false }];
    const cache = seedBadge(5);
    const { result } = renderSync(cache, []);

    await act(async () => {
      result.current.syncMarkUnread('n1');
    });

    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });

  it('deleting an unread notification decrements; deleting a read one does not', async () => {
    mockNotifications = [
      { id: 'n1', isRead: false },
      { id: 'n2', isRead: true },
    ];
    const cache = seedBadge(5);
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
    // Second delete resolved too — the count must still reflect only the
    // unread removal.
    await waitFor(() =>
      expect(mockStoreActions.removeNotification).toHaveBeenCalledWith('n2'),
    );
    expect(readBadge(cache)?.unreadNotificationCount).toBe(4);
  });

  it('mark-all-read zeroes the count and clears the urgent flag', async () => {
    mockNotifications = [{ id: 'n1', isRead: false }];
    const cache = seedBadge(5, true);
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
  });

  it('an error-union payload adjusts nothing', async () => {
    mockNotifications = [{ id: 'n1', isRead: false }];
    const cache = seedBadge(5);
    const { result } = renderSync(cache, [markReadMock('not-found')]);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    await waitFor(() => expect(mockStoreActions.markAsRead).toHaveBeenCalled());
    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });

  it('clamps at zero when the cached count is already stale-low', async () => {
    mockNotifications = [{ id: 'n1', isRead: false }];
    const cache = seedBadge(0);
    const { result } = renderSync(cache, [markReadMock()]);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    await waitFor(() => expect(mockStoreActions.markAsRead).toHaveBeenCalled());
    expect(readBadge(cache)?.unreadNotificationCount).toBe(0);
  });

  it('no-ops without throwing when no user id is in scope', async () => {
    mockNotifications = [{ id: 'n1', isRead: false }];
    mockUser = null;
    const cache = seedBadge(5);
    const { result } = renderSync(cache, [markReadMock()]);

    await act(async () => {
      result.current.syncMarkAsRead('n1');
    });

    await waitFor(() => expect(mockStoreActions.markAsRead).toHaveBeenCalled());
    expect(readBadge(cache)?.unreadNotificationCount).toBe(5);
  });
});

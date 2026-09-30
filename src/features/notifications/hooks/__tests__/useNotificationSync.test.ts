import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import type { InMemoryCache } from '@apollo/client';
import type { MockDataFor, MockFor } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  MarkNotificationAsReadDocument,
  DeleteNotificationDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import {
  DeleteMultipleNotificationsDocument,
  MarkAllNotificationsAsReadDocument,
} from '#features/notifications/graphql/bulkNotificationMutations.generated';
import {
  NotificationSummaryDocument,
  type NotificationSummaryQuery,
} from '#features/notifications/graphql/notifications.generated';
import {
  ErrorCode,
  NotificationStatus,
  NotificationType,
} from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { readNotificationStatus } from '#features/notifications/utils/notificationCacheWrites';
import { useNotificationSync } from '../useNotificationSync';

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/errorService');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// Whether a notification is unread is read from the cache, which is also what
// renders it, so the two cannot disagree. The store holds only the expiration
// enrichment a removal clears.
const mockClearExpirationLink = jest.fn();

jest.mock('#store', () => ({
  useStore: {
    getState: () => ({
      clearExpirationLink: mockClearExpirationLink,
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

type Summary = NotificationSummaryQuery['notificationSummary'];

/** The caller's badge as the server states it; its id is the user id. */
const summary = (unreadCount: number, hasUrgent = true): Summary => ({
  __typename: 'NotificationSummary',
  id: 'user-1',
  unreadCount,
  hasUrgent,
});

const seedRows = (rows: Array<{ id: string; status: NotificationStatus }>) =>
  seedCache([
    // Complete, because `captureNotification` snapshots the cached row and
    // `restoreNotifications` writes that snapshot back through the FULL
    // `useNotificationsOnLaunch_notification` fragment. Seeding two fields
    // makes the restore write two fields, so the row the test asserts was
    // restored reads back incomplete.
    ...rows.map(r => ({
      __typename: 'Notification',
      id: r.id,
      status: r.status,
      title: 'Seeded',
      message: 'Seeded message',
      // `SYSTEM` is a `NotificationCategory`, not a `NotificationType` — the
      // type enum has no such member, so the seed described a notification the
      // schema cannot produce.
      type: NotificationType.ListUpdated,
      category: 'SYSTEM',
      priority: 'NORMAL',
      payload: null,
      actionUrl: null,
      sourceId: null,
      sourceType: null,
      sentAt: '2026-01-01T00:00:00.000Z',
      readAt: null,
      expiresAt: null,
      isAuthoredContent: false,
    })),
  ]);

/**
 * A cache holding the rows the badge counts and, unless `unreadCount` is null,
 * the badge itself under `Query.notificationSummary`.
 *
 * The rows matter: the hook asks the cache the list renders from whether a
 * notification is unread, not a Zustand mirror of it.
 */
const seedFeed = (
  unreadCount: number | null,
  rows: Array<{ id: string; status: NotificationStatus }> = [],
) => {
  const cache = seedRows(rows);
  if (unreadCount !== null) {
    cache.writeQuery({
      query: NotificationSummaryDocument,
      data: {
        __typename: 'Query',
        notificationSummary: summary(unreadCount),
      },
    });
  }
  return cache;
};

// The enum has no `UNREAD` member: an unread notification is `SENT` (or
// `PENDING`). A mock spelling it `'UNREAD'` writes a status the schema cannot
// produce, and the row only reads back correctly until the result lands.
const UNREAD = NotificationStatus.Sent;
const READ = NotificationStatus.Read;

const readBadge = (cache: InMemoryCache) =>
  cache.readQuery({ query: NotificationSummaryDocument })?.notificationSummary;

type MarkReadRefusal = 'not-found' | 'forbidden';

const markReadRefusals: Record<
  MarkReadRefusal,
  MockDataFor<typeof MarkNotificationAsReadDocument>['markNotificationAsRead']
> = {
  'not-found': {
    __typename: 'NotFoundError',
    code: ErrorCode.NotFound,
    message: 'gone',
    resource: 'Notification',
    resourceId: 'n1',
  },
  forbidden: {
    __typename: 'ForbiddenError',
    code: ErrorCode.Forbidden,
    message: 'no',
  },
};

const markReadRefusedMock = (
  refusal: MarkReadRefusal,
): MockFor<typeof MarkNotificationAsReadDocument> => ({
  request: { query: MarkNotificationAsReadDocument, variables: () => true },
  result: { data: { markNotificationAsRead: markReadRefusals[refusal] } },
});

/** A mark-read the server answers with the badge it holds afterwards. */
const markReadMock = (
  stated: Summary,
): MockFor<typeof MarkNotificationAsReadDocument> => ({
  request: { query: MarkNotificationAsReadDocument, variables: () => true },
  result: {
    data: {
      markNotificationAsRead: {
        __typename: 'MarkNotificationAsReadPayload',
        notification: { __typename: 'Notification', id: 'n1', status: READ },
        notificationSummary: stated,
      },
    },
  },
});

const deleteMock = (
  stated: Summary,
): MockFor<typeof DeleteNotificationDocument> => ({
  request: { query: DeleteNotificationDocument, variables: () => true },
  result: {
    data: {
      deleteNotification: {
        __typename: 'DeleteNotificationPayload',
        notificationSummary: stated,
      },
    },
  },
});

const deleteRejectedMock = (): MockFor<typeof DeleteNotificationDocument> => ({
  request: { query: DeleteNotificationDocument, variables: () => true },
  result: {
    data: {
      deleteNotification: {
        __typename: 'ForbiddenError',
        code: ErrorCode.Forbidden,
        message: 'no',
      },
    },
  },
});

const deleteAlreadyGoneMock = (): MockFor<
  typeof DeleteNotificationDocument
> => ({
  request: { query: DeleteNotificationDocument, variables: () => true },
  result: {
    data: {
      deleteNotification: {
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'gone',
        resource: 'Notification',
        resourceId: 'n1',
      },
    },
  },
});

const deleteMultipleMock = (
  ids: string[],
  stated: Summary,
): MockFor<typeof DeleteMultipleNotificationsDocument> => ({
  request: {
    query: DeleteMultipleNotificationsDocument,
    variables: () => true,
  },
  result: {
    data: {
      deleteMultipleNotifications: {
        __typename: 'DeleteMultipleNotificationsPayload',
        summary: { __typename: 'BulkSummary', total: ids.length },
        notificationSummary: stated,
      },
    },
  },
});

const markAllMock = (): MockFor<typeof MarkAllNotificationsAsReadDocument> => ({
  request: { query: MarkAllNotificationsAsReadDocument, variables: () => true },
  result: {
    data: {
      markAllNotificationsAsRead: {
        __typename: 'MarkAllNotificationsAsReadPayload',
        summary: { __typename: 'BulkSummary', total: 3 },
        notificationSummary: summary(0, false),
      },
    },
  },
});

const renderSync = (cache: InMemoryCache, operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useNotificationSync(), { cache, operationMocks });

describe('useNotificationSync — the cached badge', () => {
  it('mark-read moves the row and the badge before the server answers', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadMock(summary(4))]);

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.syncMarkAsRead('n1');
    });

    expect(readNotificationStatus(cache, 'n1')).toBe(READ);
    expect(readBadge(cache)).toMatchObject({ unreadCount: 4, hasUrgent: true });
    await act(() => pending);
    expect(readBadge(cache)?.unreadCount).toBe(4);
  });

  // "A response that states a count settles it": the local −1 is only a
  // stand-in until the answer, never a delta applied on top of it.
  it("the response's stated summary settles the badge, with no delta on top", async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadMock(summary(7, false))]);

    await act(async () => {
      await result.current.syncMarkAsRead('n1');
    });

    await waitFor(() => expect(readBadge(cache)).toEqual(summary(7, false)));
    expect(readNotificationStatus(cache, 'n1')).toBe(READ);
  });

  it('mark-read of an already-read notification fires nothing and adjusts nothing', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: READ }]);
    const { result } = renderSync(cache, []);

    await act(async () => {
      await result.current.syncMarkAsRead('n1');
    });

    expect(readBadge(cache)?.unreadCount).toBe(5);
  });

  it('deleting an unread notification decrements at once; deleting a read one does not', async () => {
    const cache = seedFeed(5, [
      { id: 'n1', status: UNREAD },
      { id: 'n2', status: READ },
    ]);
    const { result } = renderSync(cache, [
      deleteMock(summary(4)),
      deleteMock(summary(4)),
    ]);

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.syncDelete('n1');
    });
    expect(readBadge(cache)?.unreadCount).toBe(4);
    await act(() => pending);

    act(() => {
      pending = result.current.syncDelete('n2');
    });
    expect(readBadge(cache)?.unreadCount).toBe(4);
    await act(() => pending);

    expect(readNotificationStatus(cache, 'n2')).toBeUndefined();
    expect(readBadge(cache)?.unreadCount).toBe(4);
  });

  it('mark-all-read zeroes the badge at once and flips the rows', async () => {
    const cache = seedFeed(5, [
      { id: 'n1', status: UNREAD },
      { id: 'n2', status: READ },
    ]);
    const { result } = renderSync(cache, [markAllMock()]);

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.syncMarkAllAsRead();
    });

    expect(readBadge(cache)).toEqual(summary(0, false));
    // The mutation returns a summary count and no ids, so the rows have to be
    // found locally or the list would not move at all.
    expect(readNotificationStatus(cache, 'n1')).toBe(READ);
    await act(() => pending);
    expect(readBadge(cache)).toEqual(summary(0, false));
  });

  // The refusal arrives as a RESOLVED result carrying an error-union member,
  // not as a throw — so the rollback has to read the result, not sit in a
  // catch that never runs.
  it('an error-union payload puts the row and the badge back', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadRefusedMock('forbidden')]);

    await act(async () => {
      await result.current.syncMarkAsRead('n1');
    });

    await waitFor(() =>
      expect(readNotificationStatus(cache, 'n1')).toBe(UNREAD),
    );
    expect(readBadge(cache)?.unreadCount).toBe(5);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });

  it('a mark-read answered "not found" removes the row, with nothing shown', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadRefusedMock('not-found')]);

    await act(async () => {
      await result.current.syncMarkAsRead('n1');
    });

    expect(readNotificationStatus(cache, 'n1')).toBeUndefined();
    expect(readBadge(cache)?.unreadCount).toBe(4);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('a delete leaves no record of the notification in the cache', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [deleteMock(summary(4))]);

    await act(async () => {
      await result.current.syncDelete('n1');
    });

    expect(cache.extract()).not.toHaveProperty(['Notification:n1']);
  });

  it('clearing read notifications leaves no record of them in the cache', async () => {
    const cache = seedFeed(5, [
      { id: 'n1', status: READ },
      { id: 'n2', status: READ },
    ]);
    const { result } = renderSync(cache, [
      deleteMultipleMock(['n1', 'n2'], summary(5)),
    ]);

    await act(async () => {
      await result.current.syncClearRead(['n1', 'n2']);
    });

    expect(cache.extract()).not.toHaveProperty(['Notification:n1']);
    expect(cache.extract()).not.toHaveProperty(['Notification:n2']);
    expect(readBadge(cache)?.unreadCount).toBe(5);
  });

  it('a delete answered "not found" stays deleted, with nothing shown', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [deleteAlreadyGoneMock()]);

    await act(async () => {
      await result.current.syncDelete('n1');
    });

    expect(readNotificationStatus(cache, 'n1')).toBeUndefined();
    expect(readBadge(cache)?.unreadCount).toBe(4);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  // The rollback must not be `cache.restore(cache.extract())`: that replaces
  // the whole store, discarding anything written while the mutation is in
  // flight.
  it('a refused delete restores the row and the badge, leaving other entities alone', async () => {
    const cache = seedFeed(5, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [deleteRejectedMock()]);

    await act(async () => {
      const pending = result.current.syncDelete('n1');
      // Lands between the eviction and the refusal, exactly as an in-flight
      // query result or a subscription push would.
      cache.writeFragment({
        id: cache.identify({ __typename: 'Notification', id: 'n2' })!,
        fragment: gql`
          fragment _TestOther on Notification {
            id
            status
          }
        `,
        data: { __typename: 'Notification', id: 'n2', status: UNREAD },
      });
      await pending;
    });

    await waitFor(() =>
      expect(readNotificationStatus(cache, 'n1')).toBe(UNREAD),
    );
    expect(readBadge(cache)?.unreadCount).toBe(5);
    expect(readNotificationStatus(cache, 'n2')).toBe(UNREAD);
  });

  it('clamps at zero when the cached count is already stale-low', async () => {
    const cache = seedFeed(0, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadMock(summary(0))]);

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.syncMarkAsRead('n1');
    });

    expect(readNotificationStatus(cache, 'n1')).toBe(READ);
    expect(readBadge(cache)?.unreadCount).toBe(0);
    await act(() => pending);
  });

  it('moves the row without throwing when no badge is cached', async () => {
    const cache = seedFeed(null, [{ id: 'n1', status: UNREAD }]);
    const { result } = renderSync(cache, [markReadMock(summary(0))]);

    await act(async () => {
      await result.current.syncMarkAsRead('n1');
    });

    // The row is identified by its own id; the badge has nowhere to be read
    // from until a query loads `Query.notificationSummary`.
    await waitFor(() => expect(readNotificationStatus(cache, 'n1')).toBe(READ));
    expect(readBadge(cache)).toBeUndefined();
  });
});

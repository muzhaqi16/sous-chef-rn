/**
 * The OS badge follows the cached unread count.
 *
 * Exercised against a real `InMemoryCache` rather than a mocked store
 * subscription: the count is server state now, and the property that matters —
 * "a not-yet-loaded count must not be applied as 0" — is a fact about reading
 * an empty cache, which a mock would only restate.
 */
import notifee from '@notifee/react-native';
import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { logger } from '#/utils/environment';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { setBadgeCount: jest.fn().mockResolvedValue(undefined) },
}));

// A getter, not a captured value: the module under test imports `client` at
// load time, which is before `mockCache` is assigned. Reading it lazily is what
// lets each test start from a fresh cache.
let mockCache: InMemoryCache;
jest.mock('#/apollo/client', () => ({
  get client() {
    return { cache: mockCache };
  },
}));

import { setupBadgeSync } from '../badgeSync';

const mockSetBadgeCount = notifee.setBadgeCount as jest.Mock;

const writeCount = (count: number) =>
  mockCache.writeQuery({
    query: GetUnreadNotificationsDocument,
    data: {
      __typename: 'Query' as const,
      me: {
        __typename: 'User',
        id: 'me',
        unreadNotificationCount: count,
        hasUrgentNotifications: false,
        notificationsConnection: {
          __typename: 'NotificationConnection',
          edges: [],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    },
  });

describe('setupBadgeSync', () => {
  let teardown: () => void = () => {};

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache = makeCache();
  });

  afterEach(() => teardown());

  // This replaces the old `isHydrated` gate. A cold start reads an empty cache,
  // which is distinguishable from a real 0 — so there is no window where a
  // default value could stomp a badge the server set on delivery.
  it('applies nothing while the count is unknown', () => {
    teardown = setupBadgeSync();

    expect(mockSetBadgeCount).not.toHaveBeenCalled();
  });

  it('applies the count once it lands in the cache', async () => {
    teardown = setupBadgeSync();

    writeCount(3);
    await Promise.resolve();

    expect(mockSetBadgeCount).toHaveBeenCalledWith(3);
  });

  it('applies a count already present when it starts', () => {
    writeCount(5);

    teardown = setupBadgeSync();

    expect(mockSetBadgeCount).toHaveBeenCalledWith(5);
  });

  it('applies each change, including a clear to zero', async () => {
    writeCount(2);
    teardown = setupBadgeSync();
    mockSetBadgeCount.mockClear();

    writeCount(0);
    await Promise.resolve();

    expect(mockSetBadgeCount).toHaveBeenCalledWith(0);
  });

  it('does not re-apply an unchanged count', async () => {
    writeCount(4);
    teardown = setupBadgeSync();
    mockSetBadgeCount.mockClear();

    writeCount(4);
    await Promise.resolve();

    expect(mockSetBadgeCount).not.toHaveBeenCalled();
  });

  it('logs and does not throw when setBadgeCount rejects', async () => {
    mockSetBadgeCount.mockRejectedValueOnce(new Error('no permission'));

    expect(() => {
      writeCount(2);
      teardown = setupBadgeSync();
    }).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      'setBadgeCount failed:',
      expect.any(Error),
    );
  });

  it('stops applying after teardown', async () => {
    writeCount(1);
    const stop = setupBadgeSync();
    mockSetBadgeCount.mockClear();

    stop();
    writeCount(9);
    await Promise.resolve();

    expect(mockSetBadgeCount).not.toHaveBeenCalled();
  });
});

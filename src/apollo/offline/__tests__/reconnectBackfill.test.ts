import { backfillActiveQueries } from '../reconnectBackfill';
import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';

jest.mock('#/apollo/client', () => ({
  client: { refetchQueries: jest.fn(async () => []) },
}));
jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { whenIdle: jest.fn(async () => {}) },
}));

beforeEach(jest.clearAllMocks);

describe('reconnect backfill', () => {
  it('refetches active queries only', async () => {
    // `active` is the scoping. Standby queries — the repo's `skip: !isFocused`
    // cross-tab watchers — and `cache-only` queries are excluded by it, as are
    // skipToken queries whose variables are unknown. The deprecated
    // `refetchObservableQueries` would refire that last group with stale
    // variables, which is why it is not used here.
    await backfillActiveQueries();

    expect(client.refetchQueries).toHaveBeenCalledWith(
      expect.objectContaining({ include: 'active' }),
    );
  });

  it('waits for the queue drain before refetching', async () => {
    // Replayed mutations write their own responses into the cache. Refetching
    // at the same moment doubles the burst and races the results.
    const order: string[] = [];
    (queueManager.whenIdle as jest.Mock).mockImplementation(async () => {
      order.push('drain');
    });
    (client.refetchQueries as jest.Mock).mockImplementation(async () => {
      order.push('refetch');
      return [];
    });

    await backfillActiveQueries();

    expect(order).toEqual(['drain', 'refetch']);
  });

  it('counts what it refetched', async () => {
    (client.refetchQueries as jest.Mock).mockImplementation(
      async ({ onQueryUpdated }) => {
        onQueryUpdated();
        onQueryUpdated();
        return [];
      },
    );

    await expect(backfillActiveQueries()).resolves.toBe(2);
  });

  it('never surfaces a failed refetch', async () => {
    // A flaky reconnect can reject individual refetches; the next transition or
    // a screen's own refresh will try again.
    (client.refetchQueries as jest.Mock).mockRejectedValue(
      new Error('network down again'),
    );

    await expect(backfillActiveQueries()).resolves.toBe(0);
  });
});

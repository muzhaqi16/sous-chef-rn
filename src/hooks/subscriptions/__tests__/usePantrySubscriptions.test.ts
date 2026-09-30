'use no memo';

/**
 * `PantryEvents` is a thin event — the envelope plus the changed entity's id —
 * so what these pin is which events are worth a read-back and which are not.
 */
import { act, waitFor } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type QueryDataFor,
} from '#/test-utils/apolloMockProvider';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import { MutationType, PantrySubtype } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { usePantrySubscriptions } from '#features/pantry/hooks/usePantrySubscriptions';
import { PantryEventsDocument } from '#features/pantry/graphql/pantry.generated';
import { PantrySummaryForEventDocument } from '#features/pantry/hooks/usePantrySubscriptions.generated';
import { todayKey } from '#/utils/dateUtils';

type CapturedOnData = (data: unknown, client: unknown) => void;

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

jest.mock('#/storage/deviceId', () => ({
  getDeviceId: jest.fn(() => 'device_this'),
}));

const mockRegister = jest.fn().mockReturnValue({});
const mockIsPendingDelete = jest.fn().mockReturnValue(false);

jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
    isPendingDelete: (id: string) => mockIsPendingDelete(id),
  },
}));

const mockAddToConnection = jest.fn();
const mockRemoveFromConnection = jest.fn();
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/cacheUpdaters'),
  createAddToParentConnectionUpdater:
    () =>
    (...args: unknown[]) =>
      mockAddToConnection(...args),
  createRemoveFromParentConnectionUpdater:
    () =>
    (...args: unknown[]) =>
      mockRemoveFromConnection(...args),
}));

/** Captures the hook's customOnData so tests can drive it with a payload. */
function captureCustomOnData() {
  let customOnData: CapturedOnData | undefined;
  mockRegister.mockImplementation((config: SubscriptionConfig) => {
    customOnData = config.customOnData as CapturedOnData | undefined;
    return {};
  });
  return (): CapturedOnData => {
    if (!customOnData) throw new Error('customOnData was not captured');
    return customOnData;
  };
}

const makeClient = (
  readFragment: jest.Mock = jest.fn(),
  query: jest.Mock = jest.fn().mockResolvedValue({ data: {} }),
) => ({ cache: { readFragment }, query });

/** The coalesced stats read-back fires on a timer; run it and let it settle. */
const flushSummaryRead = async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
};

const summaryReads = (query: jest.Mock) =>
  query.mock.calls.filter(
    ([options]) =>
      (options as { query: unknown }).query === PantrySummaryForEventDocument,
  );

/** The read-back is a promise, so the handler finishes a microtask later. */
const deliver = async (
  onData: CapturedOnData,
  payload: unknown,
  client: unknown,
) => {
  await act(async () => {
    onData(payload, client);
  });
};

const itemEvent = (
  mutation: MutationType,
  actorUserId: string | undefined = 'user-2',
) => ({
  subtype: PantrySubtype.ItemChanged,
  mutation,
  pantryId: 'pantry-1',
  actorUserId,
  node: { __typename: 'PantryItem', id: 'item-1' },
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRegister.mockReturnValue({});
  mockIsPendingDelete.mockReturnValue(false);
  useStore.setState({
    selectedPantryId: 'pantry-1',
    isHomeSelectionReady: true,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePantrySubscriptions', () => {
  it('subscribes for the selected pantry', () => {
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        document: PantryEventsDocument,
        entityType: 'PantryItem',
        userId: 'user-1',
        entityId: 'pantry-1',
      }),
    );
  });

  it('removes a deleted item without reading it back, then recounts the pantry', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient();

    await deliver(getOnData(), itemEvent(MutationType.ItemRemoved), client);

    expect(mockRemoveFromConnection).toHaveBeenCalledWith(
      client.cache,
      'pantry-1',
      'item-1',
      { evictItem: true },
    );
    // The id is the whole event — nothing to fetch for the row itself.
    expect(client.query).not.toHaveBeenCalled();

    // But the counts are derived and never pushed.
    await flushSummaryRead();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(summaryReads(client.query)).toHaveLength(1);
  });

  it('reads an item added elsewhere back before adding it', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient(
      jest.fn().mockReturnValue({
        __typename: 'PantryItem',
        id: 'item-1',
        itemId: 'catalog-1',
        storageState: 'REFRIGERATED',
        storageLocation: null,
      }),
      jest.fn().mockResolvedValue({
        data: { pantryItem: { __typename: 'PantryItem', id: 'item-1' } },
      }),
    );

    await deliver(getOnData(), itemEvent(MutationType.ItemAdded), client);

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { id: 'item-1' } }),
    );
    // The ref, not the read-back object: the updater merges what it is handed
    // over the stored record, so a denormalized read would inline entity refs.
    expect(mockAddToConnection).toHaveBeenCalledWith(
      client.cache,
      'pantry-1',
      { __typename: 'PantryItem', id: 'item-1' },
      expect.objectContaining({ skipStoreField: expect.any(Function) }),
    );
  });

  it("writes into the event's pantry, not the one selected when it arrives", async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient();

    await deliver(
      getOnData(),
      { ...itemEvent(MutationType.ItemRemoved), pantryId: 'pantry-2' },
      client,
    );
    await flushSummaryRead();

    expect(mockRemoveFromConnection).toHaveBeenCalledWith(
      client.cache,
      'pantry-2',
      'item-1',
      { evictItem: true },
    );
    expect(summaryReads(client.query)).toEqual([
      [
        expect.objectContaining({
          variables: expect.objectContaining({ id: 'pantry-2' }),
        }),
      ],
    ]);
  });

  it('skips the add when the item cannot be read back', async () => {
    // Offline, or deleted between the event and the read.
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient(
      jest.fn(),
      jest.fn().mockResolvedValue({ data: { pantryItem: null } }),
    );

    await deliver(getOnData(), itemEvent(MutationType.ItemAdded), client);

    expect(mockAddToConnection).not.toHaveBeenCalled();
  });

  it('does not read back an update to a row nothing is showing', async () => {
    // readFragment returns null — no mounted list holds this item, so warming
    // it would be a request for a row nobody is looking at.
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient(jest.fn().mockReturnValue(null));

    await deliver(getOnData(), itemEvent(MutationType.ItemUpdated), client);
    await flushSummaryRead();

    // Only the counts, which an update elsewhere can still move.
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(summaryReads(client.query)).toHaveLength(1);
    expect(mockAddToConnection).not.toHaveBeenCalled();
  });

  it('reads back an update to a row the cache is holding', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient(
      jest.fn().mockReturnValue({ __typename: 'PantryItem', id: 'item-1' }),
      jest.fn().mockResolvedValue({
        data: { pantryItem: { __typename: 'PantryItem', id: 'item-1' } },
      }),
    );

    await deliver(getOnData(), itemEvent(MutationType.ItemUpdated), client);

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { id: 'item-1' } }),
    );
    // An update moves no connection membership — normalization did the work.
    expect(mockAddToConnection).not.toHaveBeenCalled();
  });

  it('ignores its own echo', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient();

    await deliver(
      getOnData(),
      itemEvent(MutationType.ItemAdded, 'user-1'),
      client,
    );
    await flushSummaryRead();

    // The response applied the row; only the counts, which a local write
    // moves just in part, are read back.
    expect(summaryReads(client.query)).toHaveLength(1);
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(mockAddToConnection).not.toHaveBeenCalled();
  });

  it('skips an echo while a local delete is in flight', async () => {
    mockIsPendingDelete.mockReturnValue(true);
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient();

    await deliver(getOnData(), itemEvent(MutationType.ItemUpdated), client);
    await flushSummaryRead();

    expect(client.query).not.toHaveBeenCalled();
    expect(mockRemoveFromConnection).not.toHaveBeenCalled();
  });

  it('recounts once for a burst of deletes made elsewhere', async () => {
    // The counts are aggregates, so the last read wins: one read however many
    // rows another device just cleared.
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient();

    for (let i = 0; i < 12; i++) {
      await deliver(getOnData(), itemEvent(MutationType.ItemRemoved), client);
    }

    expect(client.query).not.toHaveBeenCalled();
    await flushSummaryRead();
    expect(summaryReads(client.query)).toHaveLength(1);
  });

  it('re-reads the pantry summary when its metadata changes', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient();

    await deliver(
      getOnData(),
      {
        subtype: PantrySubtype.PantryUpdated,
        mutation: MutationType.Updated,
        pantryId: 'pantry-1',
        actorUserId: 'user-2',
        node: { __typename: 'Pantry', id: 'pantry-1' },
      },
      client,
    );
    await flushSummaryRead();

    expect(summaryReads(client.query)).toHaveLength(1);
  });

  describe('echo suppression', () => {
    it('drops the echo of a write this device made', async () => {
      const getOnData = captureCustomOnData();
      renderHookWithApollo(() => usePantrySubscriptions('user-1'));
      const client = makeClient();

      await deliver(
        getOnData(),
        {
          ...itemEvent(MutationType.ItemUpdated, 'user-1'),
          originatorClientId: 'device_this',
        },
        client,
      );
      await flushSummaryRead();

      // No read-back of the row; the counts only.
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(summaryReads(client.query)).toHaveLength(1);
    });

    it('applies a write the SAME user made on another device', async () => {
      // The whole reason this keys on the device: the mutation response landed
      // on the other device, so this one has nothing applied yet.
      const getOnData = captureCustomOnData();
      renderHookWithApollo(() => usePantrySubscriptions('user-1'));
      const client = makeClient(
        jest.fn().mockReturnValue({ __typename: 'PantryItem', id: 'item-1' }),
        jest.fn().mockResolvedValue({
          data: { pantryItem: { __typename: 'PantryItem', id: 'item-1' } },
        }),
      );

      await deliver(
        getOnData(),
        {
          ...itemEvent(MutationType.ItemUpdated, 'user-1'),
          originatorClientId: 'device_other',
        },
        client,
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.objectContaining({ variables: { id: 'item-1' } }),
      );
    });

    it('applies a system-initiated event, which names no actor at all', async () => {
      // Background jobs send neither an originator nor an actor. The fallback
      // must read that as "not mine" rather than dropping it.
      const getOnData = captureCustomOnData();
      renderHookWithApollo(() => usePantrySubscriptions('user-1'));
      const client = makeClient(
        jest.fn().mockReturnValue({ __typename: 'PantryItem', id: 'item-1' }),
        jest.fn().mockResolvedValue({
          data: { pantryItem: { __typename: 'PantryItem', id: 'item-1' } },
        }),
      );

      await deliver(
        getOnData(),
        {
          ...itemEvent(MutationType.ItemUpdated, undefined),
          originatorClientId: null,
        },
        client,
      );

      expect(client.query).toHaveBeenCalled();
    });
  });
});

describe('usePantrySubscriptions: event envelope and the cache', () => {
  it('keeps the envelope out of the cache, so an event for a just-deleted row cannot re-create it', async () => {
    // `removeItem` evicts the row before the mutation fires; the server pushes
    // this event before the mutation resolves. A cacheable subscription would
    // normalise `node { id }` into a bare PantryItem, the connection edge would
    // stop dangling, and Apollo would refetch GetPantry to repair the now
    // incomplete result — once per delete. `fetchPolicy: 'no-cache'` is what
    // stops the write; `__tests__/apollo/subscriptionEnvelopeWrite.test.ts`
    // shows the damage the write does.
    const cache = makeCache();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'), {
      cache,
      operationMocks: [
        {
          request: {
            query: PantryEventsDocument,
            variables: { pantryId: 'pantry-1' },
          },
          result: {
            data: {
              pantryEvents: {
                __typename: 'PantryEvent',
                originatorClientId: 'device_other',
                actorUserId: 'user-2',
                mutation: MutationType.ItemRemoved,
                subtype: PantrySubtype.ItemChanged,
                pantryId: 'pantry-1',
                timestamp: '2026-01-01T00:00:00.000Z',
                node: { __typename: 'PantryItem', id: 'item-1' },
              },
            },
          },
        },
      ],
    });

    // MockLink delivers the subscription result on a timer.
    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    expect(cache.extract()['PantryItem:item-1']).toBeUndefined();
    expect(cache.extract().ROOT_SUBSCRIPTION).toBeUndefined();
  });
});

describe('usePantrySubscriptions: the counts after a change made elsewhere', () => {
  const summary = (
    count: number,
  ): QueryDataFor<typeof PantrySummaryForEventDocument> => ({
    __typename: 'Query',
    pantry: {
      __typename: 'Pantry',
      id: 'pantry-1',
      name: 'Kitchen Pantry',
      description: null,
      isDefault: true,
      version: 1,
      stats: {
        __typename: 'PantryStats',
        totalItems: count,
        expiringCount: 0,
        expiredCount: 0,
        lowStockCount: 0,
        storageStateCounts: {
          __typename: 'StorageStateCounts',
          refrigerated: 0,
          frozen: 0,
          ambient: count,
          none: 0,
        },
        storageLocationCounts: [],
      },
    },
  });

  it('brings the header and tab counts back in line with the rows', async () => {
    // Another device cleared 12 rows: each event removes its row, and nothing
    // else moved the counts until they were read back.
    const variables = { id: 'pantry-1', today: todayKey() };
    const cache = makeCache();
    cache.writeQuery({
      query: PantrySummaryForEventDocument,
      variables,
      data: summary(14),
    });
    const read = recordMock(PantrySummaryForEventDocument, {
      data: summary(2),
    });
    const getOnData = captureCustomOnData();
    const { result } = renderHookWithApollo(
      () => {
        usePantrySubscriptions('user-1');
        return useApolloClient();
      },
      { cache, operationMocks: [read.mock] },
    );

    for (let i = 0; i < 12; i++) {
      await deliver(
        getOnData(),
        {
          ...itemEvent(MutationType.ItemRemoved),
          originatorClientId: 'device_other',
        },
        result.current,
      );
    }
    await flushSummaryRead();
    await waitFor(() => expect(read.fired).toEqual([variables]));
    // MockLink answers on a timer of its own.
    await flushSummaryRead();

    const stats = cache.readQuery({
      query: PantrySummaryForEventDocument,
      variables,
    })?.pantry?.stats;
    expect(stats?.totalItems).toBe(2);
    expect(stats?.storageStateCounts?.ambient).toBe(2);
  });
});

describe('usePantrySubscriptions: a pantry the server has not created yet', () => {
  afterEach(() => {
    unconfirmedCreates.confirm('pantry-1');
  });

  it('subscribes only once its create is acknowledged', async () => {
    // Refused before the create lands, a subscription completes and nothing
    // reopens it — so opening early costs the session its events.
    unconfirmedCreates.mark('pantry-1');
    const events = recordMock(PantryEventsDocument, {
      error: new Error('stream ended'),
    });

    renderHookWithApollo(() => usePantrySubscriptions('user-1'), {
      operationMocks: [events.mock],
    });
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(events.fired).toHaveLength(0);

    act(() => {
      unconfirmedCreates.confirm('pantry-1');
    });

    await waitFor(() =>
      expect(events.fired).toContainEqual({ pantryId: 'pantry-1' }),
    );
  });
});

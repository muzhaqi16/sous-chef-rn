'use no memo';

/**
 * `PantryEvents` is a thin event — the envelope plus the changed entity's id —
 * so what these pin is which events are worth a read-back and which are not.
 */
import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import { MutationType, PantrySubtype } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { usePantrySubscriptions } from '#features/pantry/hooks/usePantrySubscriptions';
import { PantryEventsDocument } from '#features/pantry/graphql/pantry.generated';

type CapturedOnData = (data: unknown, client: unknown) => void;

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

jest.mock('#/storage/deviceId', () => ({
  getDeviceIdSync: jest.fn(() => 'device_this'),
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
        subscriptionName: 'PantryEvents',
        entityType: 'PantryItem',
        userId: 'user-1',
        entityId: 'pantry-1',
      }),
    );
  });

  it('removes a deleted item without a read-back', async () => {
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
    // The id is the whole event — nothing to fetch.
    expect(client.query).not.toHaveBeenCalled();
  });

  it('reads an item added elsewhere back before adding it', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient(
      jest.fn(),
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
    expect(mockAddToConnection).toHaveBeenCalledWith(client.cache, 'pantry-1', {
      __typename: 'PantryItem',
      id: 'item-1',
    });
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

    expect(client.query).not.toHaveBeenCalled();
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

    expect(client.query).not.toHaveBeenCalled();
    expect(mockAddToConnection).not.toHaveBeenCalled();
  });

  it('skips an echo while a local delete is in flight', async () => {
    mockIsPendingDelete.mockReturnValue(true);
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient();

    await deliver(getOnData(), itemEvent(MutationType.ItemUpdated), client);

    expect(client.query).not.toHaveBeenCalled();
    expect(mockRemoveFromConnection).not.toHaveBeenCalled();
  });

  it('coalesces a burst of pantry-stat events into one read', async () => {
    // The stats are derived, so the server can emit PANTRY_UPDATED per item
    // change. They are aggregates — the last read wins.
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => usePantrySubscriptions('user-1'));
    const client = makeClient();
    const statEvent = {
      subtype: PantrySubtype.PantryUpdated,
      mutation: MutationType.Updated,
      pantryId: 'pantry-1',
      actorUserId: 'user-2',
      node: { __typename: 'Pantry', id: 'pantry-1' },
    };

    await deliver(getOnData(), statEvent, client);
    await deliver(getOnData(), statEvent, client);
    await deliver(getOnData(), statEvent, client);

    expect(client.query).not.toHaveBeenCalled();
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(client.query).toHaveBeenCalledTimes(1);
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

      expect(client.query).not.toHaveBeenCalled();
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

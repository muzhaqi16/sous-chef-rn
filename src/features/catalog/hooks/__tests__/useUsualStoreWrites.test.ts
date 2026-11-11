import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import { ApolloProvider, useApolloClient } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createQueueLink } from '#/apollo/offlineQueue/queueLink';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { useStore } from '#store';
import { alertService } from '#/services/alertService';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { withDeadline } from '#/test-utils/cacheWaits';
import { settledInAct } from '#/test-utils/settledInAct';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { ErrorCode, UsualStoreSource } from '#/graphql/generated/schemaTypes';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import {
  listNewUsualStore,
  readUsualStores,
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { storeChoiceName } from '#domain/stores';
import { t } from '#/i18n';
import {
  useUsualStores,
  type UsualStoreRow,
} from '#features/catalog/hooks/useUsualStores';
import { useUsualStoreWrites } from '#features/catalog/hooks/useUsualStoreWrites';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from '#features/catalog/hooks/useUsualStoreWrites.generated';
import { CreateReceiptCheckInDocument } from '#features/receipts/hooks/useReceiptCheckIn.generated';

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: {
    requestDrain: jest.fn(),
    drainAfterPass: jest.fn(),
    withdrawUnqueueableWrite: jest.fn(),
  },
}));

const entry = (
  storeId: string,
  name: string,
  over: Partial<UsualStoreEntry> = {},
): UsualStoreEntry => ({
  __typename: 'UsualStore',
  id: `home-1:${storeId}`,
  addedVia: UsualStoreSource.Receipt,
  pinned: false,
  compared: true,
  lastUsedAt: '2026-10-20T12:00:00.000Z',
  store: { __typename: 'Store', id: storeId, name, address: null, chain: null },
  chain: null,
  ...over,
});

const banksville = entry('s1', 'Giant Eagle Banksville');
const marketDistrict = entry('s2', 'Giant Eagle Market District', {
  lastUsedAt: '2026-10-10T12:00:00.000Z',
});

const seeded = () => {
  const cache = makeCache();
  writeUsualStores(cache, 'home-1', [banksville, marketDistrict]);
  return cache;
};

const useBoth = () => ({
  read: useUsualStores('home-1', { fetchPolicy: 'cache-first' }),
  writes: useUsualStoreWrites('home-1'),
  client: useApolloClient(),
});

const idsOf = (list: UsualStoreEntry[] | null) =>
  (list ?? []).map(row => row.id).sort();

/**
 * Waits, inside `act`, until the list the hook's own query holds satisfies
 * `ok`, so the hook renders it. Read off that query rather than the cache: a
 * refused write's layer drops at once, and the hook hears of it a task later.
 */
const listSettles = async (
  result: { current: ReturnType<typeof useBoth> },
  ok: (list: UsualStoreEntry[] | null) => boolean,
) => {
  const [hookQuery] = [
    ...result.current.client.getObservableQueries('active'),
  ].filter(query => query.queryName === operationNameOf(UsualStoresDocument));
  if (!hookQuery) throw new Error('the hook holds no list query');
  let seen: UsualStoreEntry[] | null = null;
  const settled = (list: UsualStoreEntry[] | null | undefined) => {
    seen = list ?? null;
    return ok(seen);
  };
  await act(async () => {
    await withDeadline(
      done => {
        if (settled(hookQuery.getCurrentResult().data?.usualStores)) {
          done();
          return () => undefined;
        }
        const subscription = hookQuery.subscribe(({ data }) => {
          if (settled(data?.usualStores)) done();
        });
        return () => subscription.unsubscribe();
      },
      () =>
        `the hook's list never settled; it last held ${JSON.stringify(
          idsOf(seen),
        )}`,
    );
  });
};

const holdsIds =
  (...ids: string[]) =>
  (list: UsualStoreEntry[] | null) =>
    JSON.stringify(idsOf(list)) === JSON.stringify([...ids].sort());

const pinnedIn =
  (id: string, pinned: boolean) => (list: UsualStoreEntry[] | null) =>
    list?.find(row => row.id === id)?.pinned === pinned;

const names = (rows: UsualStoreRow[] | null) =>
  rows?.map(row => storeChoiceName(row.choice, t));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUsualStoreWrites', () => {
  it('pins at once, sends the pin, and takes the answer as the list', async () => {
    const pin = recordMock(UpdateUsualStoreDocument, {
      data: {
        updateUsualStore: {
          __typename: 'UpdateUsualStorePayload',
          usualStores: [{ ...banksville, pinned: true }, marketDistrict],
        },
      },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [pin.mock],
    });

    let saved: Promise<boolean> | undefined;
    act(() => {
      saved = result.current.writes.setPinned(
        { store: { id: 's1', name: 'Giant Eagle Banksville' } },
        true,
      );
    });

    await listSettles(result, pinnedIn(banksville.id, true));
    expect(result.current.read.stores?.[0]).toMatchObject({
      key: 'store:s1',
      pinned: true,
    });
    expect(await settledInAct(() => saved)).toBe(true);
    expect(pin.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's1' }, pinned: true } },
    ]);
  });

  // "Could you save?" compares the list at these stores.
  it('sends a second tap only once the first has answered, so they land in order', async () => {
    const store = { store: { id: 's1', name: 'Giant Eagle Banksville' } };
    const pinned = (value: boolean) =>
      recordMock(UpdateUsualStoreDocument, {
        match: vars => inputOf(vars).pinned === value,
        held: value,
        data: {
          updateUsualStore: {
            __typename: 'UpdateUsualStorePayload',
            usualStores: [{ ...banksville, pinned: value }, marketDistrict],
          },
        },
      });
    const pin = pinned(true);
    const unpin = pinned(false);
    const log = operationLog();
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      links: [log.link],
      operationMocks: [pin.mock, unpin.mock],
    });

    let tapped: Promise<boolean[]> | undefined;
    act(() => {
      tapped = Promise.all([
        result.current.writes.setPinned(store, true),
        result.current.writes.setPinned(store, false),
      ]);
    });
    await log.requested(UpdateUsualStoreDocument);
    await act(async () => undefined);

    expect(pin.fired).toHaveLength(1);
    expect(unpin.fired).toHaveLength(0);

    pin.release();
    await settledInAct(() => tapped);

    expect(unpin.fired).toHaveLength(1);
  });

  it('re-reads the list savings once a write is applied, not while it is queued', async () => {
    const refetchQueries = jest.spyOn(ApolloClient.prototype, 'refetchQueries');
    const pinned = recordMock(UpdateUsualStoreDocument, {
      data: {
        updateUsualStore: {
          __typename: 'UpdateUsualStorePayload',
          usualStores: [{ ...banksville, pinned: true }, marketDistrict],
        },
      },
      maxUsageCount: 1,
    });
    const queued = recordMock(UpdateUsualStoreDocument, {
      data: { updateUsualStore: null },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [pinned.mock, queued.mock],
    });
    const banks = { store: { id: 's1', name: 'Giant Eagle Banksville' } };

    await settledInAct(() => result.current.writes.setPinned(banks, true));
    expect(refetchQueries).toHaveBeenCalledTimes(1);
    expect(refetchQueries).toHaveBeenCalledWith({ include: ['ListSavings'] });

    await settledInAct(() => result.current.writes.setPinned(banks, false));
    expect(refetchQueries).toHaveBeenCalledTimes(1);
    refetchQueries.mockRestore();
  });

  it('adds a picked store at once, and the answer names it once', async () => {
    const aldi = entry('s3', 'ALDI Wilkinsburg', {
      addedVia: UsualStoreSource.Picked,
      lastUsedAt: '2026-10-29T12:00:00.000Z',
    });
    const add = recordMock(AddUsualStoreDocument, {
      data: {
        addUsualStore: {
          __typename: 'AddUsualStorePayload',
          usualStores: [aldi, banksville, marketDistrict],
        },
      },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [add.mock],
    });

    let saved: Promise<boolean> | undefined;
    act(() => {
      saved = result.current.writes.add({
        store: { id: 's3', name: 'ALDI Wilkinsburg' },
      });
    });

    await listSettles(result, list => idsOf(list).length === 3);
    expect(names(result.current.read.stores)).toContain('ALDI Wilkinsburg');
    await settledInAct(() => saved);
    expect(add.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's3' } } },
    ]);
    await listSettles(
      result,
      holdsIds(aldi.id, banksville.id, marketDistrict.id),
    );
    expect(names(result.current.read.stores)).toEqual([
      'ALDI Wilkinsburg',
      'Giant Eagle Banksville',
      'Giant Eagle Market District',
    ]);
  });

  it('adds a whole chain by its id', async () => {
    const add = recordMock(AddUsualStoreDocument, {
      data: { addUsualStore: null },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [add.mock],
    });

    await settledInAct(() =>
      result.current.writes.add({
        chain: { id: 'chain-aldi', name: 'ALDI' },
      }),
    );

    expect(add.fired).toEqual([
      { input: { homeId: 'home-1', target: { chainId: 'chain-aldi' } } },
    ]);
  });

  // The spec's "a member adds it again".
  it('hides a removed store, and adding it again shows it again', async () => {
    const remove = recordMock(RemoveUsualStoreDocument, {
      data: {
        removeUsualStore: {
          __typename: 'RemoveUsualStorePayload',
          usualStores: [{ id: banksville.id }],
        },
      },
    });
    const add = recordMock(AddUsualStoreDocument, {
      data: {
        addUsualStore: {
          __typename: 'AddUsualStorePayload',
          usualStores: [
            banksville,
            { ...marketDistrict, addedVia: UsualStoreSource.Picked },
          ],
        },
      },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [remove.mock, add.mock],
    });

    act(() => {
      void result.current.writes.remove({
        store: { id: 's2', name: 'Giant Eagle Market District' },
      });
    });
    await listSettles(result, holdsIds(banksville.id));
    expect(names(result.current.read.stores)).toEqual([
      'Giant Eagle Banksville',
    ]);

    await settledInAct(() =>
      result.current.writes.add({
        store: { id: 's2', name: 'Giant Eagle Market District' },
      }),
    );
    await listSettles(result, holdsIds(banksville.id, marketDistrict.id));
    expect(names(result.current.read.stores)).toEqual([
      'Giant Eagle Banksville',
      'Giant Eagle Market District',
    ]);
    expect(remove.fired).toHaveLength(1);
    expect(add.fired).toHaveLength(1);
  });

  it('puts a store back when its removal is refused', async () => {
    const remove = recordMock(RemoveUsualStoreDocument, {
      data: {
        removeUsualStore: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'Not a member of this home',
        },
      },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [remove.mock],
    });

    let saved: Promise<boolean> | undefined;
    act(() => {
      saved = result.current.writes.remove({
        store: { id: 's2', name: 'Giant Eagle Market District' },
      });
    });
    expect(await settledInAct(() => saved)).toBe(false);
    await listSettles(result, holdsIds(banksville.id, marketDistrict.id));
    expect(names(result.current.read.stores)).toEqual([
      'Giant Eagle Banksville',
      'Giant Eagle Market District',
    ]);
    expect(alertService.alert).toHaveBeenCalled();
  });

  it('says why a 21st store is refused, and unpins it again', async () => {
    const pin = recordMock(UpdateUsualStoreDocument, {
      data: {
        updateUsualStore: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'Value is out of the permitted range',
          field: 'target',
        },
      },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [pin.mock],
    });

    await settledInAct(() =>
      result.current.writes.setPinned(
        { store: { id: 's2', name: 'Giant Eagle Market District' } },
        true,
      ),
    );

    expect(alertService.alert).toHaveBeenCalledWith(
      'Too many stores',
      'You can keep up to 20 stores. Remove or unpin one, then try again.',
    );
    await listSettles(result, pinnedIn(marketDistrict.id, false));
    expect(
      result.current.read.stores?.find(row => row.key === 'store:s2'),
    ).toMatchObject({ pinned: false });
  });

  // Pinning counts toward the 20 as well, so the pin behind a refused add is
  // refused too; its undo must not bring back the add's row.
  it('keeps a store out when its add and the pin behind it are refused', async () => {
    const refusal = {
      code: ErrorCode.ValidationFailed,
      message: 'Value is out of the permitted range',
      field: 'target',
    };
    const add = recordMock(AddUsualStoreDocument, {
      data: { addUsualStore: { __typename: 'ValidationError', ...refusal } },
    });
    const pin = recordMock(UpdateUsualStoreDocument, {
      data: { updateUsualStore: { __typename: 'ValidationError', ...refusal } },
    });
    const cache = seeded();
    const { result } = renderHookWithApollo(useBoth, {
      cache,
      operationMocks: [add.mock, pin.mock],
    });
    const aldi = { store: { id: 's3', name: 'ALDI Wilkinsburg' } };

    let both: Promise<boolean[]> | undefined;
    act(() => {
      both = Promise.all([
        result.current.writes.add(aldi),
        result.current.writes.setPinned(aldi, true),
      ]);
    });
    expect(await settledInAct(() => both)).toEqual([false, false]);
    await listSettles(result, holdsIds(banksville.id, marketDistrict.id));

    expect(pin.fired).toHaveLength(1);
    expect(readUsualStores(cache, 'home-1')?.map(row => row.id)).toEqual([
      banksville.id,
      marketDistrict.id,
    ]);
  });
});

// A check-in lists its store under a minted id, until a read brings the server's.
describe('a store a check-in listed', () => {
  const aldi = { store: { id: 's3', name: 'ALDI Wilkinsburg' } };
  const removal = (...ids: string[]) =>
    recordMock(RemoveUsualStoreDocument, {
      data: {
        removeUsualStore: {
          __typename: 'RemoveUsualStorePayload',
          usualStores: ids.map(id => ({ id })),
        },
      },
    });
  const listed = () => {
    const cache = seeded();
    listNewUsualStore(
      cache,
      { homeId: 'home-1', choice: aldi },
      '2026-11-01T12:00:00.000Z',
    );
    return cache;
  };

  it('goes with its removal, whose answer cannot name its id', async () => {
    const { result } = renderHookWithApollo(useBoth, {
      cache: listed(),
      operationMocks: [removal(banksville.id, marketDistrict.id).mock],
    });

    await settledInAct(() => result.current.writes.remove(aldi));
    await listSettles(result, holdsIds(banksville.id, marketDistrict.id));

    expect(names(result.current.read.stores)).toEqual([
      'Giant Eagle Banksville',
      'Giant Eagle Market District',
    ]);
  });

  it('stays through the removal of another store', async () => {
    const { result } = renderHookWithApollo(useBoth, {
      cache: listed(),
      operationMocks: [removal(banksville.id, 'home-1:s3').mock],
    });

    await settledInAct(() =>
      result.current.writes.remove({
        store: { id: 's2', name: 'Giant Eagle Market District' },
      }),
    );
    await listSettles(result, list => idsOf(list).length === 2);

    expect(names(result.current.read.stores)).toEqual([
      'ALDI Wilkinsburg',
      'Giant Eagle Banksville',
    ]);
  });
});

describe('useUsualStoreWrites while offline', () => {
  const USER = {
    id: 'user-1',
    email: 'tani@example.com',
    emailVerified: true,
    onBoarded: true,
  };

  beforeEach(() => {
    useStore.setState({ user: USER, isOnline: false, apiReachable: null });
  });

  afterEach(() => {
    queueStore.clearQueueForUser(USER.id);
    useStore.setState({ user: null, isOnline: true, apiReachable: null });
  });

  // Replayed in this order, the server ends with the store unpinned.
  it('queues a pin and an unpin in order, and keeps the list as tapped', async () => {
    const client = new ApolloClient({
      cache: seeded(),
      link: ApolloLink.from([createQueueLink(), new MockLink([])]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ApolloProvider, { client, children });
    const { result } = renderHook(useBoth, { wrapper });

    await settledInAct(async () => {
      await result.current.writes.setPinned(
        { store: { id: 's2', name: 'Giant Eagle Market District' } },
        true,
      );
      await result.current.writes.setPinned(
        { store: { id: 's2', name: 'Giant Eagle Market District' } },
        false,
      );
    });

    const target = { storeId: 's2' };
    await listSettles(result, pinnedIn(marketDistrict.id, false));
    expect(
      queueStore
        .getMutationsForUser(USER.id)
        .map(m => [m.operationName, m.variables]),
    ).toEqual([
      [
        'UpdateUsualStore',
        { input: { homeId: 'home-1', target, pinned: true } },
      ],
      [
        'UpdateUsualStore',
        { input: { homeId: 'home-1', target, pinned: false } },
      ],
    ]);
    expect(
      result.current.read.stores?.find(row => row.key === 'store:s2'),
    ).toMatchObject({ pinned: false });
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  describe('online, with an earlier write still queued', () => {
    const sent: (string | undefined)[] = [];
    const networkDown = new ApolloLink(
      operation =>
        new Observable(observer => {
          sent.push(operation.operationName);
          observer.error(new NetworkRequestError('Network request failed'));
        }),
    );
    const render = () => {
      const client = new ApolloClient({
        cache: seeded(),
        link: ApolloLink.from([createQueueLink(), networkDown]),
        defaultOptions: APOLLO_DEFAULT_OPTIONS,
      });
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(ApolloProvider, { client, children });
      return renderHook(useBoth, { wrapper }).result;
    };

    beforeEach(() => {
      sent.length = 0;
      useStore.setState({ isOnline: true, apiReachable: true });
      queueStore.setCurrentUserId(USER.id);
    });

    afterEach(() => {
      queueStore.clearCurrentUserId();
    });

    // Sent ahead of the add, the removal would find nothing and the add's
    // replay would put the store back.
    it('keeps a removal behind the add the network failed', async () => {
      const result = render();
      const giantEagle = { store: { id: 's9', name: 'Giant Eagle' } };

      await settledInAct(async () => {
        await result.current.writes.add(giantEagle);
        await result.current.writes.remove(giantEagle);
      });

      expect(sent).toEqual(['AddUsualStore']);
      expect(
        queueStore.getMutationsForUser(USER.id).map(m => m.operationName),
      ).toEqual(['AddUsualStore', 'RemoveUsualStore']);
    });

    // The check-in adds its store on replay, so a removal sent ahead of it
    // would be undone.
    it('keeps a removal behind the check-in that adds the store', async () => {
      const result = render();
      queueStore.addMutation(
        makeQueuedMutation({
          ...queuedMutationFor(CreateReceiptCheckInDocument),
          userId: USER.id,
          orderedBy: 's3',
        }),
      );

      await settledInAct(() =>
        result.current.writes.remove({
          store: { id: 's3', name: 'ALDI Wilkinsburg' },
        }),
      );

      expect(sent).toEqual([]);
      expect(
        queueStore.getMutationsForUser(USER.id).map(m => m.operationName),
      ).toEqual(['CreateReceiptCheckIn', 'RemoveUsualStore']);
    });
  });
});

import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createQueueLink } from '#/apollo/offlineQueue/queueLink';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { useStore } from '#store';
import { alertService } from '#/services/alertService';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { ErrorCode, UsualStoreSource } from '#/graphql/generated/schemaTypes';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import {
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
});

const names = (rows: UsualStoreRow[] | null) =>
  rows?.map(row => storeChoiceName(row.choice, t));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

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

    await drainTimers();
    expect(result.current.read.stores?.[0]).toMatchObject({
      key: 'store:s1',
      pinned: true,
    });
    await drained(() => expect(saved).resolves.toBe(true));
    expect(pin.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's1' }, pinned: true } },
    ]);
  });

  // "Could you save?" compares the list at these stores.
  it('sends a second tap only once the first has answered, so they land in order', async () => {
    const store = { store: { id: 's1', name: 'Giant Eagle Banksville' } };
    const pinned = (value: boolean) =>
      recordMock(UpdateUsualStoreDocument, {
        match: vars => (vars.input as { pinned?: boolean }).pinned === value,
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
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [pin.mock, unpin.mock],
    });

    let tapped: Promise<boolean[]> | undefined;
    act(() => {
      tapped = Promise.all([
        result.current.writes.setPinned(store, true),
        result.current.writes.setPinned(store, false),
      ]);
    });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    expect(pin.fired).toHaveLength(1);
    expect(unpin.fired).toHaveLength(0);

    pin.release();
    await drainTimers();
    await act(async () => {
      await tapped;
    });

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

    await drained(() => result.current.writes.setPinned(banks, true));
    expect(refetchQueries).toHaveBeenCalledTimes(1);
    expect(refetchQueries).toHaveBeenCalledWith({ include: ['ListSavings'] });

    await drained(() => result.current.writes.setPinned(banks, false));
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

    await drainTimers();
    expect(names(result.current.read.stores)).toContain('ALDI Wilkinsburg');
    await drained(() => saved);
    expect(add.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's3' } } },
    ]);
    await drainTimers();
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

    await drained(() =>
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
    await drainTimers();
    expect(names(result.current.read.stores)).toEqual([
      'Giant Eagle Banksville',
    ]);

    await drained(() =>
      result.current.writes.add({
        store: { id: 's2', name: 'Giant Eagle Market District' },
      }),
    );
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
    await drained(() => expect(saved).resolves.toBe(false));
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

    await drained(() =>
      result.current.writes.setPinned(
        { store: { id: 's2', name: 'Giant Eagle Market District' } },
        true,
      ),
    );

    expect(alertService.alert).toHaveBeenCalledWith(
      'Too many stores',
      'You can keep up to 20 stores. Remove or unpin one, then try again.',
    );
    await drainTimers();
    expect(
      result.current.read.stores?.find(row => row.key === 'store:s2'),
    ).toMatchObject({ pinned: false });
  });

  // Pinning counts toward the 20 as well, so the pin behind a refused add is
  // refused too; its undo must not bring back the add's row.
  it('keeps a store out when its add and the pin behind it are refused', async () => {
    const overTheLimit = {
      __typename: 'ValidationError',
      code: ErrorCode.ValidationFailed,
      message: 'Value is out of the permitted range',
      field: 'target',
    } as const;
    const add = recordMock(AddUsualStoreDocument, {
      data: { addUsualStore: overTheLimit },
    });
    const pin = recordMock(UpdateUsualStoreDocument, {
      data: { updateUsualStore: overTheLimit },
    });
    const cache = seeded();
    const { result } = renderHookWithApollo(useBoth, {
      cache,
      operationMocks: [add.mock, pin.mock],
    });
    const aldi = { store: { id: 's3', name: 'ALDI Wilkinsburg' } };

    let added: Promise<boolean> | undefined;
    let pinned: Promise<boolean> | undefined;
    act(() => {
      added = result.current.writes.add(aldi);
      pinned = result.current.writes.setPinned(aldi, true);
    });
    await drained(async () => {
      await expect(added).resolves.toBe(false);
      await expect(pinned).resolves.toBe(false);
    });

    expect(pin.fired).toHaveLength(1);
    expect(readUsualStores(cache, 'home-1')?.map(row => row.id)).toEqual([
      banksville.id,
      marketDistrict.id,
    ]);
  });
});

// A receipt's check-in adds its store on the server; the device shows it at once.
describe('a store learned from a receipt', () => {
  const aldi = { store: { id: 's3', name: 'ALDI Wilkinsburg' } };

  it('shows at once, as from a receipt, and sends nothing of its own', async () => {
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [],
    });

    act(() => {
      result.current.writes.learn(aldi, Promise.resolve(true));
    });

    await drainTimers();
    expect(
      result.current.read.stores?.find(row => row.key === 'store:s3'),
    ).toMatchObject({ addedVia: UsualStoreSource.Receipt });
  });

  it('undoes at once, and removes it once the check-in is recorded', async () => {
    const remove = recordMock(RemoveUsualStoreDocument, {
      data: {
        removeUsualStore: {
          __typename: 'RemoveUsualStorePayload',
          usualStores: [{ id: banksville.id }, { id: marketDistrict.id }],
        },
      },
    });
    const { result, unmount } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [remove.mock],
    });
    let undo: (() => Promise<void>) | undefined;
    act(() => {
      undo = result.current.writes.learn(aldi, Promise.resolve(true));
    });

    // The review has left by the time Undo is pressed.
    unmount();
    await drained(() => undo?.());

    expect(remove.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's3' } } },
    ]);
  });

  const serverList = (...entries: UsualStoreEntry[]) =>
    recordMock(UsualStoresDocument, { data: { usualStores: entries } });
  const answeredRemoval = () =>
    recordMock(RemoveUsualStoreDocument, {
      data: {
        removeUsualStore: {
          __typename: 'RemoveUsualStorePayload',
          usualStores: [{ id: banksville.id }, { id: marketDistrict.id }],
        },
      },
    });
  const rootList = (cache: ReturnType<typeof seeded>) =>
    cache
      .readQuery({
        query: UsualStoresDocument,
        variables: { homeId: 'home-1' },
        optimistic: false,
      })
      ?.usualStores.map(({ id }) => id);

  it('leaves the root as the server said it, whatever is pending', () => {
    const cache = seeded();
    const { result } = renderHookWithApollo(useBoth, {
      cache,
      operationMocks: [],
    });

    act(() => {
      result.current.writes.learn(aldi, new Promise(() => undefined));
    });

    expect(rootList(cache)).toEqual([banksville.id, marketDistrict.id]);
    expect(cache.extract()['UsualStore:local-store:s3']).toBeUndefined();
  });

  it('takes the server’s entry once its list names the store', async () => {
    const aldiEntry = entry('s3', 'ALDI Wilkinsburg');
    const cache = seeded();
    const remove = answeredRemoval();
    const { result } = renderHookWithApollo(useBoth, {
      cache,
      operationMocks: [
        serverList(banksville, marketDistrict, aldiEntry).mock,
        remove.mock,
      ],
    });

    act(() => {
      result.current.writes.learn(aldi, Promise.resolve(true));
    });
    await drainTimers();

    expect(rootList(cache)).toContain(aldiEntry.id);

    // With the layer gone, a removal's answer leaves nothing to put it back.
    await drained(() => result.current.writes.remove(aldi));
    await drainTimers();
    expect(names(result.current.read.stores)).toEqual([
      'Giant Eagle Banksville',
      'Giant Eagle Market District',
    ]);
  });

  // Another member's removal comes as a list without it, which a layer left
  // behind would hide.
  it('holds nothing over the list once the server has named the store', async () => {
    const cache = seeded();
    const { result } = renderHookWithApollo(useBoth, {
      cache,
      operationMocks: [
        serverList(banksville, marketDistrict, entry('s3', 'ALDI Wilkinsburg'))
          .mock,
      ],
    });
    act(() => {
      result.current.writes.learn(aldi, Promise.resolve(true));
    });
    await drainTimers();

    act(() => {
      writeUsualStores(cache, 'home-1', [banksville, marketDistrict]);
    });
    await drainTimers();

    expect(
      result.current.read.stores?.some(row => row.key === 'store:s3'),
    ).toBe(false);
  });

  it('keeps showing while the check-in waits, until a removal ends it', async () => {
    const cache = seeded();
    const remove = answeredRemoval();
    const { result } = renderHookWithApollo(useBoth, {
      cache,
      operationMocks: [
        serverList(banksville, marketDistrict).mock,
        remove.mock,
      ],
    });

    act(() => {
      result.current.writes.learn(aldi, Promise.resolve(true));
    });
    await drainTimers();

    expect(
      result.current.read.stores?.some(row => row.key === 'store:s3'),
    ).toBe(true);

    await drained(() => result.current.writes.remove(aldi));
    await drainTimers();
    expect(
      result.current.read.stores?.some(row => row.key === 'store:s3'),
    ).toBe(false);
  });

  it('sends nothing for a check-in that was refused', async () => {
    const remove = recordMock(RemoveUsualStoreDocument, {
      data: { removeUsualStore: null },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [remove.mock],
    });
    let undo: (() => Promise<void>) | undefined;
    act(() => {
      undo = result.current.writes.learn(aldi, Promise.resolve(false));
    });

    await drained(() => undo?.());

    expect(remove.fired).toEqual([]);
    await drainTimers();
    expect(names(result.current.read.stores)).toEqual([
      'Giant Eagle Banksville',
      'Giant Eagle Market District',
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

    await drained(async () => {
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
    await drainTimers();
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

      await drained(async () => {
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
    it("keeps an Undo's removal behind the check-in that adds the store", async () => {
      const result = render();
      queueStore.addMutation(
        makeQueuedMutation({
          ...queuedMutationFor(CreateReceiptCheckInDocument),
          userId: USER.id,
          orderedBy: 's3',
        }),
      );
      let undo: (() => Promise<void>) | undefined;
      act(() => {
        undo = result.current.writes.learn(
          { store: { id: 's3', name: 'ALDI Wilkinsburg' } },
          Promise.resolve(true),
        );
      });

      await drained(() => undo?.());

      expect(sent).not.toContain('RemoveUsualStore');
      expect(
        queueStore.getMutationsForUser(USER.id).map(m => m.operationName),
      ).toEqual(['CreateReceiptCheckIn', 'RemoveUsualStore']);
    });
  });

  // A queued check-in resolves its learning as recorded: the removal queues
  // behind it, and the queue sends them in that order.
  it("queues an Undo's removal while the receipt's check-in waits", async () => {
    const client = new ApolloClient({
      cache: seeded(),
      link: ApolloLink.from([createQueueLink(), new MockLink([])]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ApolloProvider, { client, children });
    const { result } = renderHook(useBoth, { wrapper });
    let undo: (() => Promise<void>) | undefined;
    act(() => {
      undo = result.current.writes.learn(
        { store: { id: 's3', name: 'ALDI Wilkinsburg' } },
        Promise.resolve(true),
      );
    });

    await drained(() => undo?.());

    expect(
      queueStore
        .getMutationsForUser(USER.id)
        .map(m => [m.operationName, m.variables]),
    ).toEqual([
      [
        'RemoveUsualStore',
        { input: { homeId: 'home-1', target: { storeId: 's3' } } },
      ],
    ]);
    expect(
      result.current.read.stores?.some(row => row.key === 'store:s3'),
    ).toBe(false);
  });
});

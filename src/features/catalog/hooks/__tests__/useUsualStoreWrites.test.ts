import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApolloClient, ApolloLink } from '@apollo/client';
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
import {
  ErrorCode,
  UsualStoreSource,
} from '#/graphql/generated/schemaTypes';
import {
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
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from '#features/catalog/hooks/useUsualStoreWrites.generated';

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: {
    requestDrain: jest.fn(),
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

    await waitFor(() =>
      expect(result.current.read.stores?.[0]).toMatchObject({
        key: 'store:s1',
        pinned: true,
      }),
    );
    await act(async () => {
      await expect(saved).resolves.toBe(true);
    });
    expect(pin.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's1' }, pinned: true } },
    ]);
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

    await waitFor(() =>
      expect(names(result.current.read.stores)).toContain('ALDI Wilkinsburg'),
    );
    await act(async () => {
      await saved;
    });
    expect(add.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's3' } } },
    ]);
    await waitFor(() =>
      expect(names(result.current.read.stores)).toEqual([
        'ALDI Wilkinsburg',
        'Giant Eagle Banksville',
        'Giant Eagle Market District',
      ]),
    );
  });

  it('adds a whole chain by its id', async () => {
    const add = recordMock(AddUsualStoreDocument, {
      data: { addUsualStore: null },
    });
    const { result } = renderHookWithApollo(useBoth, {
      cache: seeded(),
      operationMocks: [add.mock],
    });

    await act(async () => {
      await result.current.writes.add({
        chain: { id: 'chain-aldi', name: 'ALDI' },
      });
    });

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
          usualStores: [banksville],
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
      void result.current.writes.remove({ store: { id: 's2', name: 'Giant Eagle Market District' } });
    });
    await waitFor(() =>
      expect(names(result.current.read.stores)).toEqual([
        'Giant Eagle Banksville',
      ]),
    );

    await act(async () => {
      await result.current.writes.add({ store: { id: 's2', name: 'Giant Eagle Market District' } });
    });
    await waitFor(() =>
      expect(names(result.current.read.stores)).toEqual([
        'Giant Eagle Banksville',
        'Giant Eagle Market District',
      ]),
    );
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
      saved = result.current.writes.remove({ store: { id: 's2', name: 'Giant Eagle Market District' } });
    });
    await act(async () => {
      await expect(saved).resolves.toBe(false);
    });

    await waitFor(() =>
      expect(names(result.current.read.stores)).toEqual([
        'Giant Eagle Banksville',
        'Giant Eagle Market District',
      ]),
    );
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

    await act(async () => {
      await result.current.writes.setPinned({ store: { id: 's2', name: 'Giant Eagle Market District' } }, true);
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Too many stores',
      'You can keep up to 20 stores. Remove or unpin one, then try again.',
    );
    await waitFor(() =>
      expect(
        result.current.read.stores?.find(row => row.key === 'store:s2'),
      ).toMatchObject({ pinned: false }),
    );
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

    await act(async () => {
      await result.current.writes.setPinned({ store: { id: 's2', name: 'Giant Eagle Market District' } }, true);
      await result.current.writes.setPinned({ store: { id: 's2', name: 'Giant Eagle Market District' } }, false);
    });

    const target = { storeId: 's2' };
    await waitFor(() =>
      expect(
        queueStore
          .getMutationsForUser(USER.id)
          .map(m => [m.operationName, m.variables]),
      ).toEqual([
        ['UpdateUsualStore', { input: { homeId: 'home-1', target, pinned: true } }],
        ['UpdateUsualStore', { input: { homeId: 'home-1', target, pinned: false } }],
      ]),
    );
    expect(
      result.current.read.stores?.find(row => row.key === 'store:s2'),
    ).toMatchObject({ pinned: false });
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});

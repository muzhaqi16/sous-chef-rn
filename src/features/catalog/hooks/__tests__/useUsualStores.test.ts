import { waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import { storeChoiceName } from '#domain/stores';
import { t } from '#/i18n';
import { writeUsualStores } from '#features/catalog/cache/usualStores';
import { useUsualStores } from '#features/catalog/hooks/useUsualStores';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';

const giantEagle = {
  id: 'home-1:s1',
  addedVia: UsualStoreSource.Receipt,
  pinned: false,
  compared: true,
  lastUsedAt: '2026-10-20T12:00:00.000Z',
  store: {
    id: 's1',
    name: 'Giant Eagle Banksville',
    address: '1 Banksville Rd',
    chain: { id: 'chain-ge', name: 'Giant Eagle' },
  },
  chain: { id: 'chain-ge', name: 'Giant Eagle' },
};
const anyAldi = {
  id: 'home-1:chain-aldi',
  addedVia: UsualStoreSource.Picked,
  pinned: false,
  compared: true,
  lastUsedAt: '2026-10-25T12:00:00.000Z',
  store: null,
  chain: { id: 'chain-aldi', name: 'ALDI' },
};

const answering = (usualStores: object[]) =>
  recordMock(UsualStoresDocument, { data: { usualStores } });

const render = (
  mock: ReturnType<typeof answering>['mock'],
  fetchPolicy: 'cache-first' | 'cache-and-network' = 'cache-and-network',
  cache = makeCache(),
) =>
  renderHookWithApollo(() => useUsualStores('home-1', { fetchPolicy }), {
    cache,
    operationMocks: [mock],
  });

describe('useUsualStores', () => {
  it("reads the household's stores as rows", async () => {
    const query = answering([giantEagle]);
    const { result } = render(query.mock);

    await waitFor(() => expect(result.current.stores).toHaveLength(1));
    expect(query.fired).toEqual([{ homeId: 'home-1' }]);
    expect(result.current.stores?.[0]).toEqual({
      key: 'store:s1',
      choice: { store: { id: 's1', name: 'Giant Eagle Banksville' } },
      address: '1 Banksville Rd',
      storeNumber: null,
      distanceKm: null,
      added: true,
      hasPrices: false,
      pinned: false,
      compared: true,
      addedVia: UsualStoreSource.Receipt,
      lastUsedAt: '2026-10-20T12:00:00.000Z',
    });
  });

  it('names a whole chain as any of its stores, with no address', async () => {
    const { result } = render(answering([anyAldi]).mock);

    await waitFor(() => expect(result.current.stores).toHaveLength(1));
    const [row] = result.current.stores ?? [];
    expect(row).toMatchObject({
      key: 'chain:chain-aldi',
      choice: { chain: { id: 'chain-aldi', name: 'ALDI' } },
      address: null,
    });
    expect(row && storeChoiceName(row.choice, t)).toBe('ALDI (any store)');
  });

  it('puts pinned stores first, then compared ones, then the most recently used', async () => {
    const { result } = render(
      answering([
        {
          ...giantEagle,
          lastUsedAt: '2026-06-01T12:00:00.000Z',
          compared: false,
        },
        anyAldi,
        {
          ...giantEagle,
          id: 'home-1:s2',
          pinned: true,
          lastUsedAt: '2026-05-01T12:00:00.000Z',
          store: { ...giantEagle.store, id: 's2', name: 'Kroger Banksville' },
        },
        {
          ...giantEagle,
          id: 'home-1:s3',
          lastUsedAt: '2026-10-28T12:00:00.000Z',
          store: {
            ...giantEagle.store,
            id: 's3',
            name: 'Giant Eagle Market District',
          },
        },
      ]).mock,
    );

    await waitFor(() => expect(result.current.stores).toHaveLength(4));
    expect(
      result.current.stores?.map(row => storeChoiceName(row.choice, t)),
    ).toEqual([
      'Kroger Banksville',
      'Giant Eagle Market District',
      'ALDI (any store)',
      'Giant Eagle Banksville',
    ]);
  });

  it('shows the cached stores offline, with no error', async () => {
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [
      {
        __typename: 'UsualStore',
        ...anyAldi,
        chain: { __typename: 'StoreChain', ...anyAldi.chain },
      },
    ]);
    const offline = recordMock(UsualStoresDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = render(offline.mock, 'cache-and-network', cache);

    await waitFor(() => expect(offline.fired).toHaveLength(1));
    expect(
      result.current.stores?.map(row => storeChoiceName(row.choice, t)),
    ).toEqual(['ALDI (any store)']);
    expect(result.current.error).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });

  it('says nothing is read yet while the first answer is on its way', () => {
    const { result } = render(answering([]).mock);

    expect(result.current.stores).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});

import { GraphQLError } from 'graphql';
import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import {
  recordMock,
  renderHookWithApollo,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  StorePlaceCategory,
  ErrorCode,
  UsualStoreSource,
} from '#/graphql/generated/schemaTypes';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { writeUsualStores } from '#features/catalog/cache/usualStores';
import {
  useStoreSearch,
  type StoreSearchPlace,
} from '#features/catalog/hooks/useStoreSearch';
import { StorePlacesDocument } from '#features/catalog/hooks/useStoreSearch.generated';

const aldiChain = { id: 'chain-aldi', name: 'ALDI' };
const wilkinsburg = {
  id: 's-aldi-w',
  name: 'ALDI Wilkinsburg',
  address: '401 Penn Ave, Wilkinsburg, PA',
  storeNumber: null,
  chain: aldiChain,
};
const banksville = {
  id: 's-ge-b',
  name: 'Giant Eagle Banksville',
  address: '1 Banksville Rd, Pittsburgh, PA',
  storeNumber: null,
  chain: { id: 'chain-ge', name: 'Giant Eagle' },
};

// The household already shops at Giant Eagle Banksville.
const withUsualStores = () => {
  const cache = makeCache();
  writeUsualStores(cache, 'home-1', [
    {
      __typename: 'UsualStore',
      id: 'home-1:s-ge-b',
      addedVia: UsualStoreSource.Receipt,
      pinned: false,
      compared: true,
      lastUsedAt: '2026-10-20T12:00:00.000Z',
      store: {
        __typename: 'Store',
        id: banksville.id,
        name: banksville.name,
        address: banksville.address,
        chain: { __typename: 'StoreChain', ...banksville.chain },
      },
      chain: { __typename: 'StoreChain', ...banksville.chain },
    },
  ]);
  return cache;
};

/** A store on file, as the search lists one. */
const heldAt = (
  distanceKm: number,
  store: { name: string; address?: string | null },
) => ({
  placeId: null,
  name: store.name,
  address: store.address ?? null,
  credit: null,
  distanceKm,
  store,
});

const render = (
  place: StoreSearchPlace | null,
  mocks: ReturnType<typeof recordMock>['mock'][],
) =>
  renderHookWithApollo(
    () =>
      useStoreSearch({ household: { homeId: 'home-1' }, place, chains: true }),
    { cache: withUsualStores(), operationMocks: mocks },
  );

const type = (
  result: { current: ReturnType<typeof useStoreSearch> },
  text: string,
) => {
  act(() => {
    result.current.setTerm(text);
  });
  act(() => {
    jest.advanceTimersByTime(300);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  useStore.setState({ isOnline: true });
});

describe('useStoreSearch', () => {
  it('lists the stores near a zip, nearest first, the new ones included', async () => {
    const nearby = recordMock(StorePlacesDocument, {
      data: {
        storePlaces: [heldAt(1.2, banksville), heldAt(6.4, wilkinsburg)],
      },
    });
    const { result } = render({ zip: '15220' }, [nearby.mock]);

    await drainTimers();
    expect(result.current.options).toHaveLength(2);
    expect(nearby.fired).toEqual([
      { input: { near: { zip: '15220' } }, withPrices: false },
    ]);
    expect(
      result.current.options.map(option => [
        option.key,
        option.distanceKm,
        option.added,
      ]),
    ).toEqual([
      ['store:s-ge-b', 1.2, true],
      ['store:s-aldi-w', 6.4, false],
    ]);
    expect(result.current.answered).toBe(true);
  });

  it('finds stores by name with their addresses, and offers the whole chain first', async () => {
    const search = recordMock(SearchStoresDocument, {
      data: { stores: { edges: [{ node: wilkinsburg }] } },
    });
    const { result } = render(null, [search.mock]);
    type(result, 'aldi');

    await drainTimers();
    expect(result.current.options).toHaveLength(2);
    // Only the picker marks priced stores.
    expect(search.fired).toEqual([
      { search: 'aldi', limit: 20, withPrices: false },
    ]);
    expect(result.current.options).toEqual([
      expect.objectContaining({
        key: 'chain:chain-aldi',
        choice: { chain: aldiChain },
      }),
      expect.objectContaining({
        key: 'store:s-aldi-w',
        address: '401 Penn Ave, Wilkinsburg, PA',
        distanceKm: null,
      }),
    ]);
    expect(result.current.unlistedName).toBe('aldi');
  });

  it('narrows the nearby stores by a term, with no name search besides', async () => {
    const nearby = recordMock(StorePlacesDocument, {
      data: { storePlaces: [heldAt(6.4, wilkinsburg)] },
    });
    const search = recordMock(SearchStoresDocument, {
      data: { stores: { edges: [] } },
    });
    const { result } = render({ point: { lat: 40.44, lng: -79.99 } }, [
      nearby.mock,
      search.mock,
    ]);
    type(result, 'aldi');

    await drainTimers();
    expect(nearby.fired).toContainEqual({
      input: {
        near: { point: { lat: 40.44, lng: -79.99 } },
        search: 'aldi',
        categories: Object.values(StorePlaceCategory),
      },
      withPrices: false,
    });
    expect(search.fired).toEqual([]);
  });

  // The first hundred stores by name are not "near you".
  it('lists no warmed stores before a term when asked not to', () => {
    useStore.setState({
      cachedStores: [{ id: 'cached-1', name: 'Corner Grocer', address: null }],
    } as never);
    const { result } = renderHookWithApollo(
      () =>
        useStoreSearch({
          household: { homeId: 'home-1' },
          listBeforeTyping: false,
        }),
      { cache: withUsualStores(), operationMocks: [] },
    );

    expect(result.current.options).toEqual([]);
    expect(result.current.answered).toBe(false);
    useStore.setState({ cachedStores: [] } as never);
  });

  it('asks nothing for one character', () => {
    const search = recordMock(SearchStoresDocument, {
      data: { stores: { edges: [] } },
    });
    const { result } = render(null, [search.mock]);
    type(result, 'a');

    expect(search.fired).toEqual([]);
    expect(result.current.answered).toBe(false);
    expect(result.current.unlistedName).toBeNull();
  });

  describe('a place nobody has picked', () => {
    const place = {
      placeId: 'osm:node/7',
      store: null,
      name: 'Save-A-Lot',
      address: 'Stoner Way',
      distanceKm: 1.8,
      credit: '© OpenStreetMap contributors',
    };

    it('lists it among the stores, in the order the search gave', async () => {
      const nearby = recordMock(StorePlacesDocument, {
        data: { storePlaces: [place, heldAt(2.5, banksville)] },
      });
      const { result } = render({ zip: '15221' }, [nearby.mock]);

      await drainTimers();
      expect(result.current.options).toEqual([
        expect.objectContaining({
          key: 'place:osm:node/7',
          choice: { place: { id: 'osm:node/7', name: 'Save-A-Lot' } },
          address: 'Stoner Way',
          distanceKm: 1.8,
          added: false,
        }),
        expect.objectContaining({ key: 'store:s-ge-b', added: true }),
      ]);
    });

    it('carries its credit while one is listed', async () => {
      const nearby = recordMock(StorePlacesDocument, {
        data: { storePlaces: [place] },
      });
      const { result } = render({ zip: '15221' }, [nearby.mock]);

      await drainTimers();
      expect(result.current.credit).toBe('© OpenStreetMap contributors');
    });

    it('has no credit over stores on file alone', async () => {
      const nearby = recordMock(StorePlacesDocument, {
        data: { storePlaces: [heldAt(2.5, banksville)] },
      });
      const { result } = render({ zip: '15221' }, [nearby.mock]);

      await drainTimers();
      expect(result.current.credit).toBeNull();
    });
  });

  it("asks nothing offline, and lists the household's stores", () => {
    useStore.setState({ isOnline: false });
    const nearby = recordMock(StorePlacesDocument, {
      data: { storePlaces: [] },
    });
    const { result } = render({ zip: '15220' }, [nearby.mock]);

    expect(nearby.fired).toEqual([]);
    expect(result.current.isOffline).toBe(true);
    expect(
      result.current.options.map(option => [option.key, option.added]),
    ).toEqual([['store:s-ge-b', true]]);
  });

  it('reports a zip the API has no record of', async () => {
    const refused: MockFor<typeof StorePlacesDocument> = {
      request: { query: StorePlacesDocument, variables: () => true },
      result: {
        errors: [
          new GraphQLError('That is not a US zip code on file', {
            extensions: { code: ErrorCode.ValidationFailed, field: 'near.zip' },
          }),
        ],
      },
    };
    const { result } = render({ zip: '00000' }, [refused]);

    await drainTimers();
    expect(result.current.zipRefused).toBe(true);
    expect(result.current.options).toEqual([]);
  });
});

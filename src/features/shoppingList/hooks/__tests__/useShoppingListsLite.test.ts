import { useApolloClient } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import type { MockDataFor, MockPart } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  GetShoppingListsLiteDocument,
  type GetShoppingListsLiteQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useShoppingListsQuery } from '../useShoppingListsQuery';
import { useShoppingListsLite } from '../useShoppingListsLite';

const listEdge = (
  id: string,
  name: string,
): MockPart<GetShoppingListsLiteQuery['shoppingLists']['edges'][number]> => ({
  __typename: 'ShoppingListEdge',
  cursor: id,
  node: { __typename: 'ShoppingList', id, name },
});

function overviewMock() {
  return recordMock(GetShoppingListsLiteDocument, {
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        totalCount: 2,
        edges: [listEdge('sl-1', 'Weekly'), listEdge('sl-2', 'Party')],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  });
}

const ALL_LISTS = 30;
const SERVER_DEFAULT_PAGE = 20;

/** The API's page of the account's 30 lists: `first` rows, else its default. */
function serverMock() {
  return recordMock(GetShoppingListsLiteDocument, {
    dataFor: (vars): MockDataFor<typeof GetShoppingListsLiteDocument> => {
      const first =
        typeof vars.first === 'number' ? vars.first : SERVER_DEFAULT_PAGE;
      const size = Math.min(first, ALL_LISTS);
      return {
        shoppingLists: {
          __typename: 'ShoppingListConnection',
          totalCount: ALL_LISTS,
          edges: Array.from({ length: size }, (_, i) =>
            listEdge(`sl-${i + 1}`, `List ${i + 1}`),
          ),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: size < ALL_LISTS,
            endCursor: `c${size}`,
          },
        },
      };
    },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useShoppingListsLite', () => {
  it('reads the collection the overview holds, whatever its page size', async () => {
    const cache = makeCache();
    const overview = overviewMock();
    const main = renderHookWithApollo(() => useShoppingListsQuery(), {
      cache,
      operationMocks: [overview.mock],
    });
    await drainTimers();
    expect(main.result.current.lists).toHaveLength(2);
    expect(overview.fired).toEqual([{ first: 50 }]);
    main.unmount();

    // Offline, `offlineModeLink` answers a query from this same read, so a
    // picker's page size must not miss the collection the overview holds.
    const offlineRead = cache.readQuery({
      query: GetShoppingListsLiteDocument,
      variables: {},
    });
    expect(offlineRead?.shoppingLists.edges.map(e => e.node.id)).toEqual([
      'sl-1',
      'sl-2',
    ]);

    // The network never answers: what shows is the cache's.
    const pending = recordMock(GetShoppingListsLiteDocument, { held: true });
    const picker = renderHookWithApollo(() => useShoppingListsLite(), {
      cache,
      operationMocks: [pending.mock],
    });
    expect(picker.result.current.lists.map(list => list.name)).toEqual([
      'Weekly',
      'Party',
    ]);
    picker.unmount();
  });

  it('leaves the overview its rows when a shorter page arrives', async () => {
    const cache = makeCache();
    const overview = renderHookWithApollo(() => useShoppingListsQuery(), {
      cache,
      operationMocks: [serverMock().mock],
    });
    await drainTimers();
    expect(overview.result.current.lists).toHaveLength(ALL_LISTS);

    const shortPage = recordMock(GetShoppingListsLiteDocument, {
      data: {
        shoppingLists: {
          __typename: 'ShoppingListConnection',
          totalCount: ALL_LISTS,
          edges: Array.from({ length: SERVER_DEFAULT_PAGE }, (_, i) =>
            listEdge(`sl-${i + 1}`, `List ${i + 1}`),
          ),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: true,
            endCursor: `c${SERVER_DEFAULT_PAGE}`,
          },
        },
      },
    });
    const picker = renderHookWithApollo(() => useShoppingListsLite(), {
      cache,
      operationMocks: [shortPage.mock],
    });
    await drainTimers();
    expect(shortPage.fired).toHaveLength(1);
    await drainTimers();
    expect(picker.result.current.loading).toBe(false);

    expect(overview.result.current.lists).toHaveLength(ALL_LISTS);
    const held = cache.readQuery({
      query: GetShoppingListsLiteDocument,
      variables: {},
    })?.shoppingLists;
    expect(held?.edges).toHaveLength(ALL_LISTS);
    expect(held?.pageInfo).toEqual(
      expect.objectContaining({ hasNextPage: false, endCursor: 'c30' }),
    );
    picker.unmount();
    overview.unmount();
  });

  // The warm-up reads `cache-first`, so a page a picker loaded first answers it
  // and is all the overview has offline.
  it('loads the overview’s page, so a picker that loads first leaves it whole', async () => {
    const cache = makeCache();
    const picker = renderHookWithApollo(() => useShoppingListsLite(), {
      cache,
      operationMocks: [serverMock().mock],
    });
    await drainTimers();
    expect(picker.result.current.loading).toBe(false);
    picker.unmount();

    // The network never answers: what shows is the cache's.
    const offline = recordMock(GetShoppingListsLiteDocument, { held: true });
    const overview = renderHookWithApollo(() => useShoppingListsQuery(), {
      cache,
      operationMocks: [offline.mock],
    });

    expect(overview.result.current.lists.length).toBe(ALL_LISTS);
    overview.unmount();
  });

  it('keeps the lists it had when a later read fails', async () => {
    const answered = overviewMock();
    const failed = recordMock(GetShoppingListsLiteDocument, {
      error: new Error('network down'),
    });
    const { result } = renderHookWithApollo(
      () => ({ lite: useShoppingListsLite(), client: useApolloClient() }),
      {
        operationMocks: [{ ...answered.mock, maxUsageCount: 1 }, failed.mock],
      },
    );
    await drainTimers();
    expect(result.current.lite.lists).toHaveLength(2);

    await drained(() =>
      result.current.client
        .refetchQueries({ include: 'active' })
        .catch(() => undefined),
    );

    expect(failed.fired).toHaveLength(1);
    expect(result.current.lite.lists.map(list => list.name)).toEqual([
      'Weekly',
      'Party',
    ]);
  });

  it('returns nothing when skipped', () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListsLite({ skip: true }),
      { operationMocks: [overviewMock().mock] },
    );

    expect(result.current.lists).toEqual([]);
  });
});

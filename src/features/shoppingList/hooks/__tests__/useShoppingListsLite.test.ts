import { waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import type { MockPart } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
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

describe('useShoppingListsLite', () => {
  it('reads the collection the overview holds, whatever its page size', async () => {
    const cache = makeCache();
    const overview = overviewMock();
    const main = renderHookWithApollo(() => useShoppingListsQuery(), {
      cache,
      operationMocks: [overview.mock],
    });
    await waitFor(() => expect(main.result.current.lists).toHaveLength(2));
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

    const pending = recordMock(GetShoppingListsLiteDocument, {
      delay: 60_000,
    });
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

  it('returns nothing when skipped', () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListsLite({ skip: true }),
      { operationMocks: [overviewMock().mock] },
    );

    expect(result.current.lists).toEqual([]);
  });
});

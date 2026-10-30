import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';
import {
  AddItemToShoppingListDocument,
  GetShoppingListItemsFilteredDocument,
  MoveShoppingListItemDocument,
  RemoveItemFromShoppingListDocument,
  RemoveItemsFromShoppingListDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { Items_RowFragmentDoc } from '#features/shoppingList/cache/items.generated';
import {
  addRows,
  removeRows,
  reorderRow,
  updateRow,
  type AddRowsInputs,
  type RemoveRowsInputs,
  type ReorderRowInputs,
  type UpdateRowInputs,
} from '../localWrites';

const NOW = '2026-10-30T10:00:00.000Z';
const listVariables = { id: 'list-1', first: 20, isPurchased: false };

const LIST = gql`
  fragment LocalWritesList on ShoppingList {
    totalItems
    remainingItems
  }
`;

const ROW = gql`
  fragment LocalWritesRow on ShoppingListItem {
    version
  }
`;

function setup() {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetShoppingListItemsFilteredDocument,
    variables: listVariables,
    data: {
      shoppingList: {
        __typename: 'ShoppingList',
        id: 'list-1',
        version: 1,
        itemsConnection: {
          totalCount: 1,
          edges: [
            {
              cursor: 'c-held',
              node: {
                __typename: 'ShoppingListItem',
                id: 'held',
                version: 5,
                purchaseInfo: { isPurchased: false },
              },
            },
          ],
        },
      },
    },
  });
  seedFragment(cache, {
    fragment: LIST,
    data: {
      __typename: 'ShoppingList',
      id: 'list-1',
      totalItems: 1,
      remainingItems: 1,
    },
  });
  return {
    cache,
    writes: new PendingWrites(cache, {
      AddItemToShoppingList: addRows,
      UpdateShoppingListItem: updateRow,
      RemoveItemFromShoppingList: removeRows,
      RemoveItemsFromShoppingList: removeRows,
      MoveShoppingListItem: reorderRow,
    }),
  };
}

type Setup = ReturnType<typeof setup>;

const add = ({ writes }: Setup, rowId: string) => {
  const inputs: AddRowsInputs = {
    listId: 'list-1',
    rows: [{ id: rowId, shoppingListId: 'list-1', itemName: 'Milk' }],
    now: NOW,
  };
  return writes.begin(
    AddItemToShoppingListDocument,
    {
      input: { shoppingListId: 'list-1', items: [{ id: rowId }] },
    },
    inputs,
  );
};

const answer = (...items: ({ id: string } | null)[]) => ({
  addItemsToShoppingList: {
    __typename: 'AddItemsToShoppingListPayload',
    results: items.map(item => ({ success: item !== null, item })),
  },
});

const shownIds = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery({
      query: GetShoppingListItemsFilteredDocument,
      variables: listVariables,
      optimistic,
    })
    ?.shoppingList?.itemsConnection.edges.map(({ node }) => node.id);

const counts = ({ cache }: Setup) =>
  cache.readFragment({
    id: 'ShoppingList:list-1',
    fragment: LIST,
    optimistic: true,
  });

describe('adding a row', () => {
  it('shows it and counts it once, however often it is rebuilt', () => {
    const list = setup();

    add(list, 'minted');
    list.writes.rebuild();
    list.writes.rebuild();

    expect(shownIds(list)).toEqual(['minted', 'held']);
    expect(counts(list)).toMatchObject({ totalItems: 2, remainingItems: 2 });
  });

  it('leaves the server data as it was', () => {
    const list = setup();

    add(list, 'minted');

    expect(shownIds(list, false)).toEqual(['held']);
    expect(list.cache.extract()).not.toHaveProperty([
      'ShoppingListItem:minted',
    ]);
  });

  it('keeps the version and the count of a row the server already sent', () => {
    const list = setup();

    add(list, 'held');
    list.writes.rebuild();

    expect(shownIds(list)).toEqual(['held']);
    expect(counts(list)).toMatchObject({ totalItems: 1, remainingItems: 1 });
    expect(
      list.cache.readFragment({
        id: 'ShoppingListItem:held',
        fragment: ROW,
        optimistic: true,
      }),
    ).toMatchObject({ version: 5 });
  });

  it('goes without a trace when it is refused', () => {
    const list = setup();

    const { id } = add(list, 'minted');
    list.writes.drop(id);

    expect(shownIds(list)).toEqual(['held']);
    expect(counts(list)).toMatchObject({ totalItems: 1, remainingItems: 1 });
    expect(list.cache.extract(true)).not.toHaveProperty([
      'ShoppingListItem:minted',
    ]);
  });
});

describe('an answered add', () => {
  it('lists the row the server kept', () => {
    const list = setup();
    const { id } = add(list, 'minted');
    // Apollo writes the answer's row before the write commits.
    seedFragment(list.cache, {
      fragment: Items_RowFragmentDoc,
      fragmentName: 'items_row',
      data: { __typename: 'ShoppingListItem', id: 'minted', version: 1 },
    });

    list.writes.confirm(id, answer({ id: 'minted' }));
    list.writes.rebuild();

    expect(shownIds(list, false)).toEqual(['minted', 'held']);
    expect(shownIds(list)).toEqual(['minted', 'held']);
  });

  it('leaves one line when the server folded it into a row it held', () => {
    const list = setup();
    const { id } = add(list, 'minted');

    list.writes.confirm(id, answer({ id: 'held' }));
    list.writes.rebuild();

    expect(shownIds(list)).toEqual(['held']);
    expect(list.cache.extract(true)).not.toHaveProperty([
      'ShoppingListItem:minted',
    ]);
  });

  it('leaves out a line the answer refused', () => {
    const list = setup();
    const { id } = add(list, 'minted');

    list.writes.confirm(id, answer(null));
    list.writes.rebuild();

    expect(shownIds(list)).toEqual(['held']);
  });

  it('keeps a second add when the first is answered', () => {
    const list = setup();
    const first = add(list, 'first');
    add(list, 'second');

    list.writes.confirm(first.id, answer({ id: 'held' }));
    list.writes.rebuild();

    expect(shownIds(list)).toEqual(['second', 'held']);
  });
});

describe('with a list of both kinds of row', () => {
  const COUNTS = gql`
    fragment LocalWritesCounts on ShoppingList {
      totalItems
      completedItems
      remainingItems
    }
  `;
  const purchasedVariables = { ...listVariables, isPurchased: true };

  function bothKinds() {
    const list = setup();
    seedQuery(list.cache, {
      query: GetShoppingListItemsFilteredDocument,
      variables: purchasedVariables,
      data: {
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          version: 1,
          itemsConnection: {
            totalCount: 1,
            edges: [
              {
                cursor: 'c-bought',
                node: {
                  __typename: 'ShoppingListItem',
                  id: 'bought',
                  version: 2,
                  purchaseInfo: { isPurchased: true },
                },
              },
            ],
          },
        },
      },
    });
    seedFragment(list.cache, {
      fragment: COUNTS,
      data: {
        __typename: 'ShoppingList',
        id: 'list-1',
        totalItems: 2,
        completedItems: 1,
        remainingItems: 1,
      },
    });
    return list;
  }

  const boughtIds = ({ cache }: Setup, optimistic = true) =>
    cache
      .readQuery({
        query: GetShoppingListItemsFilteredDocument,
        variables: purchasedVariables,
        optimistic,
      })
      ?.shoppingList?.itemsConnection.edges.map(({ node }) => node.id);

  const allCounts = ({ cache }: Setup) =>
    cache.readFragment({
      id: 'ShoppingList:list-1',
      fragment: COUNTS,
      optimistic: true,
    });

  const seeded = { totalItems: 2, completedItems: 1, remainingItems: 1 };

  const tick = ({ writes }: Setup, id: string, isPurchased: boolean) => {
    const inputs: UpdateRowInputs = {
      purchase: { listId: 'list-1', isPurchased, now: NOW },
    };
    return writes.begin(
      UpdateShoppingListItemDocument,
      { input: { id, version: 1, purchaseTracking: { isPurchased } } },
      inputs,
    );
  };

  describe('a tick', () => {
    it('moves the row and its counts once, however often it is rebuilt', () => {
      const list = bothKinds();

      tick(list, 'held', true);
      list.writes.rebuild();
      list.writes.rebuild();

      expect(shownIds(list)).toEqual([]);
      expect(boughtIds(list)).toEqual(['held', 'bought']);
      expect(allCounts(list)).toMatchObject({
        completedItems: 2,
        remainingItems: 0,
      });
      expect(boughtIds(list, false)).toEqual(['bought']);
    });

    it('moves nothing when the row is already in that state', () => {
      const list = bothKinds();

      tick(list, 'bought', true);

      expect(boughtIds(list)).toEqual(['bought']);
      expect(allCounts(list)).toMatchObject(seeded);
    });

    it('leaves the list as it was when refused', () => {
      const list = bothKinds();

      list.writes.drop(tick(list, 'held', true).id);

      expect(shownIds(list)).toEqual(['held']);
      expect(boughtIds(list)).toEqual(['bought']);
      expect(allCounts(list)).toMatchObject(seeded);
    });

    it('takes the counts from the answer, adding nothing to them', () => {
      const list = bothKinds();
      const { id } = tick(list, 'held', true);
      // Apollo writes the answer's row and totals before the write commits.
      seedFragment(list.cache, {
        fragment: COUNTS,
        data: {
          __typename: 'ShoppingList',
          id: 'list-1',
          totalItems: 2,
          completedItems: 2,
          remainingItems: 0,
        },
      });
      seedFragment(list.cache, {
        fragment: Items_RowFragmentDoc,
        fragmentName: 'items_row',
        data: {
          __typename: 'ShoppingListItem',
          id: 'held',
          version: 6,
          purchaseInfo: { isPurchased: true },
        },
      });

      list.writes.confirm(id, {});
      list.writes.rebuild();

      expect(boughtIds(list)).toEqual(['held', 'bought']);
      expect(boughtIds(list, false)).toEqual(['held', 'bought']);
      expect(allCounts(list)).toMatchObject({
        completedItems: 2,
        remainingItems: 0,
      });
    });

    it('writes nothing for a row the cache does not hold', () => {
      const list = bothKinds();

      tick(list, 'gone', true);

      expect(list.cache.extract(true)).not.toHaveProperty([
        'ShoppingListItem:gone',
      ]);
      expect(allCounts(list)).toMatchObject(seeded);
    });

    it('follows the queue onto the row a create merged into', () => {
      const list = bothKinds();
      const write = tick(list, 'minted', true);
      list.writes.markQueued(write.id);

      list.writes.followQueue([
        {
          ...write,
          variables: {
            input: {
              id: 'held',
              version: 5,
              purchaseTracking: { isPurchased: true },
            },
          },
        },
      ]);

      expect(boughtIds(list)).toEqual(['held', 'bought']);
    });

    it('goes when the queue lets it go', () => {
      const list = bothKinds();
      const write = tick(list, 'held', true);
      list.writes.markQueued(write.id);

      list.writes.followQueue([]);

      expect(list.writes.get(write.id)).toBeUndefined();
      expect(shownIds(list)).toEqual(['held']);
    });

    it('stays when the queue does not carry it yet', () => {
      const list = bothKinds();
      const write = tick(list, 'held', true);

      list.writes.followQueue([]);

      expect(list.writes.get(write.id)).toBeDefined();
      expect(boughtIds(list)).toEqual(['held', 'bought']);
    });
  });

  describe('removing rows', () => {
    const remove = ({ writes }: Setup, id: string) => {
      const inputs: RemoveRowsInputs = { listId: 'list-1' };
      return writes.begin(
        RemoveItemFromShoppingListDocument,
        { input: { id } },
        inputs,
      );
    };

    it('hides a row and counts it out once, however often it is rebuilt', () => {
      const list = bothKinds();

      remove(list, 'bought');
      list.writes.rebuild();
      list.writes.rebuild();

      expect(boughtIds(list)).toEqual([]);
      expect(allCounts(list)).toMatchObject({
        totalItems: 1,
        completedItems: 0,
        remainingItems: 1,
      });
      expect(boughtIds(list, false)).toEqual(['bought']);
    });

    it('counts a row removed twice once', () => {
      const list = bothKinds();

      remove(list, 'held');
      remove(list, 'held');

      expect(allCounts(list)).toMatchObject({ totalItems: 1 });
    });

    it('brings the row back when refused', () => {
      const list = bothKinds();

      list.writes.drop(remove(list, 'held').id);

      expect(shownIds(list)).toEqual(['held']);
      expect(allCounts(list)).toMatchObject(seeded);
    });

    it('leaves no row behind the answer that names it', () => {
      const list = bothKinds();
      const { id } = remove(list, 'held');

      list.writes.confirm(id, {});
      list.writes.rebuild();

      expect(shownIds(list, false)).toEqual([]);
      expect(list.cache.extract(true)).not.toHaveProperty([
        'ShoppingListItem:held',
      ]);
    });

    it('clears a batch, each row counted by its own state', () => {
      const list = bothKinds();
      const inputs: RemoveRowsInputs = { listId: 'list-1' };

      list.writes.begin(
        RemoveItemsFromShoppingListDocument,
        { input: { shoppingListId: 'list-1', ids: ['held', 'bought'] } },
        inputs,
      );

      expect(shownIds(list)).toEqual([]);
      expect(boughtIds(list)).toEqual([]);
      expect(allCounts(list)).toMatchObject({
        totalItems: 0,
        completedItems: 0,
        remainingItems: 0,
      });
    });
  });

  describe('reordering a row', () => {
    const SORT = gql`
      fragment LocalWritesSort on ShoppingListItem {
        sortOrder
      }
    `;

    const sorted = (list: Setup, id: string, sortOrder: string) =>
      seedFragment(list.cache, {
        fragment: SORT,
        data: { __typename: 'ShoppingListItem', id, sortOrder },
      });

    const move = ({ writes }: Setup, id: string, sortOrder: string) => {
      const inputs: ReorderRowInputs = {
        listId: 'list-1',
        sortOrder,
        now: NOW,
      };
      return writes.begin(
        MoveShoppingListItemDocument,
        { input: { id } },
        inputs,
      );
    };

    function ordered() {
      const list = setup();
      seedQuery(list.cache, {
        query: GetShoppingListItemsFilteredDocument,
        variables: listVariables,
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            version: 1,
            itemsConnection: {
              totalCount: 2,
              edges: [
                {
                  cursor: 'c-held',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'held',
                    version: 1,
                    sortOrder: 'a',
                  },
                },
                {
                  cursor: 'c-later',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'later',
                    version: 1,
                    sortOrder: 'c',
                  },
                },
              ],
            },
          },
        },
      });
      return list;
    }

    it('puts the row in its place, however often it is rebuilt', () => {
      const list = ordered();

      move(list, 'later', '0');
      list.writes.rebuild();

      expect(shownIds(list)).toEqual(['later', 'held']);
      expect(shownIds(list, false)).toEqual(['held', 'later']);
    });

    it('goes back when refused', () => {
      const list = ordered();

      list.writes.drop(move(list, 'later', '0').id);

      expect(shownIds(list)).toEqual(['held', 'later']);
    });

    it('takes the order the server answered', () => {
      const list = ordered();
      const { id } = move(list, 'later', 'b');
      // Apollo writes the answer's row before the write commits.
      sorted(list, 'later', '0');

      list.writes.confirm(id, {});
      list.writes.rebuild();

      expect(shownIds(list, false)).toEqual(['later', 'held']);
    });
  });
});

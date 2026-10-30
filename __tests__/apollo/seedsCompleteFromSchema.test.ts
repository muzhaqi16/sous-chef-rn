import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { Items_RowFragmentDoc } from '#features/shoppingList/cache/items.generated';

describe('a cache seed', () => {
  it('states only what it asserts on: a query’s other fields come from the SDL', () => {
    const cache = makeCache();

    seedQuery(cache, {
      query: GetShoppingListsLiteDocument,
      variables: { homeId: 'home-1', first: 20 },
      data: {
        shoppingLists: {
          edges: [
            {
              node: {
                __typename: 'ShoppingList',
                id: 'list-1',
                name: 'Weekly',
              },
            },
          ],
        },
      },
    });

    const data = cache.readQuery({
      query: GetShoppingListsLiteDocument,
      variables: { homeId: 'home-1', first: 20 },
    });
    expect(data?.shoppingLists.edges[0]?.node.name).toBe('Weekly');
  });

  it('completes a fragment on a type only an input reaches', () => {
    const cache = makeCache();

    seedFragment(cache, {
      id: 'ShoppingListItem:item-1',
      fragment: Items_RowFragmentDoc,
      fragmentName: 'items_row',
      data: { __typename: 'ShoppingListItem', id: 'item-1', version: 3 },
    });

    expect(
      cache.readFragment({
        id: 'ShoppingListItem:item-1',
        fragment: Items_RowFragmentDoc,
        fragmentName: 'items_row',
      }),
    ).toMatchObject({ id: 'item-1' });
  });

  it('keeps every value the seed states, null included', () => {
    const cache = makeCache();

    seedFragment(cache, {
      id: 'ShoppingListItem:item-1',
      fragment: gql`
        fragment SeedNullable on ShoppingListItem {
          id
          notes
          version
        }
      `,
      data: { __typename: 'ShoppingListItem', id: 'item-1', notes: null },
    });

    expect(cache.extract()['ShoppingListItem:item-1']).toMatchObject({
      notes: null,
    });
  });

  it('writes a seed of a type the SDL does not know as it stands', () => {
    const cache = makeCache();

    seedFragment(cache, {
      id: 'ProbeItem:row-1',
      fragment: gql`
        fragment SeedProbe on ProbeItem {
          id
          name
        }
      `,
      data: { __typename: 'ProbeItem', id: 'row-1', name: 'Milk' },
    });

    expect(cache.extract()['ProbeItem:row-1']).toMatchObject({ name: 'Milk' });
  });
});

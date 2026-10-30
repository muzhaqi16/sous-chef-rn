/**
 * The optimistic line's lifecycle: what is built, what is reverted, and the
 * reconcile that adopts the server id.
 */

import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import {
  addLocalShoppingListItem,
  createLocalShoppingListItem,
} from '../items';
import { Items_RowFragmentDoc } from '../items.generated';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { seedFragment } from '#/test-utils/apolloMockProvider';

describe('addLocalShoppingListItem: the row', () => {
  const writeLine = (
    cache: ReturnType<typeof makeCache>,
    fields: Parameters<typeof createLocalShoppingListItem>[1],
  ) => {
    addLocalShoppingListItem(
      cache,
      fields.shoppingListId,
      createLocalShoppingListItem('c-1', fields),
      '2026-10-30T10:00:00.000Z',
    );
    return cache.readFragment({
      id: 'ShoppingListItem:c-1',
      fragment: Items_RowFragmentDoc,
      fragmentName: 'items_row',
    });
  };

  it('writes a complete row under the client id, with neutral defaults', () => {
    const line = writeLine(makeCache(), {
      shoppingListId: 'list-1',
      itemName: 'Bread',
    });

    expect(line).toMatchObject({
      __typename: 'ShoppingListItem',
      id: 'c-1',
      quantity: 1,
      quantityInput: null,
      unitName: null,
      category: null,
      item: null,
      unit: null,
    });
    expect(line?.purchaseInfo.isPurchased).toBe(false);
  });

  it('uses the fields the create states', () => {
    const line = writeLine(makeCache(), {
      shoppingListId: 'list-1',
      itemName: 'Milk',
      quantity: 2,
      quantityInput: '2',
      unitName: 'gallon',
      category: 'Dairy',
    });

    expect(line).toMatchObject({
      quantity: 2,
      quantityInput: '2',
      unitName: 'gallon',
      category: 'Dairy',
    });
  });

  it('keeps the unit and catalog item the cache holds', () => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: gql`
        fragment HeldUnit on Unit {
          id
          name
          symbol
        }
      `,
      data: asAbbreviation({
        __typename: 'Unit',
        id: 'unit-g',
        name: 'gram',
        symbol: 'g',
      }),
    });
    seedFragment(cache, {
      fragment: gql`
        fragment HeldItem on Item {
          id
          imageUrl
        }
      `,
      data: {
        __typename: 'Item',
        id: 'item-milk',
        imageUrl: 'https://cdn.example.com/milk.jpg',
      },
    });

    const line = writeLine(cache, {
      shoppingListId: 'list-1',
      itemName: 'Milk',
      itemId: 'item-milk',
      unitId: 'unit-g',
    });

    expect(line?.unit).toMatchObject({ id: 'unit-g', symbol: 'g' });
    expect(line?.item).toMatchObject({
      id: 'item-milk',
      imageUrl: 'https://cdn.example.com/milk.jpg',
    });
  });

  // The API's rule: a line made offline is shelved where its item is.
  it("starts in its item's aisle, else OTHER", () => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: gql`
        fragment HeldDepartment on Item {
          id
          storeDepartment
        }
      `,
      data: {
        __typename: 'Item',
        id: 'item-milk',
        storeDepartment: StoreDepartment.DairyEggs,
      },
    });

    expect(
      writeLine(cache, {
        shoppingListId: 'list-1',
        itemName: 'Milk',
        itemId: 'item-milk',
      }),
    ).toMatchObject({
      storeDepartment: StoreDepartment.DairyEggs,
      storeDepartmentOverride: null,
    });
    expect(
      writeLine(makeCache(), { shoppingListId: 'list-1', itemName: 'Twine' }),
    ).toMatchObject({ storeDepartment: StoreDepartment.Other });
  });
});

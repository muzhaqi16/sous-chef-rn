/**
 * DIAGNOSTIC (temporary): does the AddItemToShoppingList response materialize
 * the catalog item image in the cache without a refetch?
 *
 * Drives the REAL useAddShoppingItem through the PRODUCTION cache (makeCache()
 * with all type policies) against a mocked server response that includes
 * item { imageUrl images } — simulating an online add where the catalog item
 * already has an image. Asserts the row's display fragment resolves the image
 * right after the mutation settles (i.e. no pull-to-refresh needed).
 */

import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  SortableItem_ItemFragmentDoc,
  type SortableItem_ItemFragment,
} from '#features/shoppingList/components/SortableShoppingList/SortableItem.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import {
  buildOptimisticShoppingList,
  addOptimisticShoppingList,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { useAddShoppingItem } from '../useAddShoppingItem';

const IMAGE_URL = 'https://img.example/lysol.jpg';
const THUMB_URL = 'https://img.example/lysol-thumb.webp';

// Server echoes the client-sent id (normal create, no catalog merge) and
// returns the resolved catalog item WITH images, plus server-enriched
// quantity/unit fields.
const echoWithImageMock: MockedResponse = {
  request: { query: AddItemToShoppingListDocument, variables: () => true },
  maxUsageCount: Number.POSITIVE_INFINITY,
  result: (vars: { input: { id: string } }) => ({
    data: {
      addItemToShoppingList: {
        __typename: 'AddItemToShoppingListPayload',
        shoppingListItem: {
          __typename: 'ShoppingListItem',
          id: vars.input.id,
          itemName: 'Lysol',
          quantity: 2,
          quantityInput: '2',
          displayFormat: DisplayFormat.Auto,
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
          version: 1,
          updatedAt: '2026-06-11T18:47:05.000Z',
          category: 'Cleaning',
          notes: null,
          unitName: 'piece',
          unit: {
            __typename: 'Unit',
            id: 'unit-piece',
            name: 'piece',
            symbol: 'pc',
          },
          sortOrder: 'a0',
          item: {
            __typename: 'Item',
            id: 'item-lysol',
            imageUrl: IMAGE_URL,
            images: [
              { __typename: 'ItemImage', url: THUMB_URL, kind: 'THUMBNAIL' },
            ],
          },
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            totalItems: 1,
            completedItems: 0,
            remainingItems: 1,
            completionRate: 0,
          },
        },
      },
    },
  }),
};

describe('DIAGNOSTIC: add shopping item image write-through', () => {
  it('row fragment resolves the server item image right after the mutation (no refetch)', async () => {
    const cache = makeCache();
    // Seed the list + empty filtered itemsConnection variants exactly the way
    // production does for a local-first list create.
    const list = buildOptimisticShoppingList(
      cache,
      'list-1',
      { name: 'Weekly Groceries' },
      { id: 'u1', email: 'u@example.com' },
    );
    addOptimisticShoppingList(cache, list);

    const refetch = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHookWithApollo(
      () => useAddShoppingItem({ listId: 'list-1', refetch }),
      { operationMocks: [echoWithImageMock], cache },
    );

    let payload: { shoppingListItem?: { id: string } } | undefined;
    await act(async () => {
      payload = (await result.current.addItem({ itemName: 'Lysol' })) as
        | { shoppingListItem?: { id: string } }
        | undefined;
    });

    expect(payload?.shoppingListItem?.id).toBeTruthy();
    const rowId = payload!.shoppingListItem!.id;

    const row = cache.readFragment<SortableItem_ItemFragment>({
      id: cache.identify({ __typename: 'ShoppingListItem', id: rowId })!,
      fragment: SortableItem_ItemFragmentDoc,
      fragmentName: 'SortableItem_item',
    });

    // The user-visible symptom: these stay at their optimistic values
    // (item: null, quantity 1, no unit) until a pull-to-refresh.
    expect(row?.item?.imageUrl).toBe(IMAGE_URL);
    expect(row?.item?.images?.[0]?.url).toBe(THUMB_URL);
    expect(row?.quantity).toBe(2);
    expect(row?.unitName).toBe('piece');

    // The refetch fallback must NOT be what makes this pass.
    expect(refetch).not.toHaveBeenCalled();
  });
});

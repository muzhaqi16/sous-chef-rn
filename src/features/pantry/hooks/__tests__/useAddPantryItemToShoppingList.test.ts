import { waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { useAddPantryItemToShoppingList } from '#features/pantry/hooks/useAddPantryItemToShoppingList';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/screens/FilteredPantryItems.generated';

/**
 * `item` is an @oneOf `ItemRefInput` the server resolves as a CATALOG item, so
 * a PantryItem id there is refused for every user on every attempt. Exercised
 * through the real operation — the harness completes the payload from the SDL
 * and rejects a fixture the schema cannot produce, which a mock at the hook
 * boundary would not.
 */
const LIST_ID = 'list-1';
const CATALOG_ITEM_ID = '694b605f8d1b03f97d92dd42';

describe('useAddPantryItemToShoppingList', () => {
  it('sends the id it is given as a catalog item reference', async () => {
    const add = recordMock(AddItemToShoppingListFromFilteredPantryDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
        },
      },
    });

    const { result } = renderHookWithApollo(
      () => useAddPantryItemToShoppingList(LIST_ID),
      { operationMocks: [add.mock] },
    );
    await waitFor(() => expect(result.current.addToList).toBeDefined());

    await result.current.addToList(CATALOG_ITEM_ID, { itemName: 'tomatoes' });

    await waitFor(() => expect(add.fired.length).toBe(1));
    const input = add.fired[0]?.input as {
      shoppingListId: string;
      items: { id: string; item: { itemId: string } }[];
    };
    expect(input.shoppingListId).toBe(LIST_ID);
    // The catalog id travels in `item.itemId`, and the row's own client id is a
    // SEPARATE field — conflating them is the defect this pins.
    expect(input.items[0]!.item).toEqual({ itemId: CATALOG_ITEM_ID });
    expect(input.items[0]!.id).not.toBe(CATALOG_ITEM_ID);
  });
});

import { useApolloClient, useMutation } from '@apollo/client/react';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/screens/FilteredPantryItems.generated';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  buildAddItemsReconcileUpdate,
  revertOptimisticShoppingListItem,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

/** Whether the row survived. The caller owns the copy for a failure. */
export type AddToListOutcome = 'kept' | 'reverted';

/**
 * Put one pantry item on the selected shopping list. The row is written before
 * firing so it survives a queued create, and the reconciler discards it when
 * the server refuses.
 */
export function useAddPantryItemToShoppingList(
  shoppingListId: string | null | undefined,
) {
  const client = useApolloClient();

  const [addToShoppingList] = useMutation(
    AddItemToShoppingListFromFilteredPantryDocument,
    {
      // Reads the list id from the mutation's own variables, so it stays
      // correct across re-renders.
      update: buildAddItemsReconcileUpdate({}),
    },
  );

  const addToList = async (
    itemId: string,
    display: { itemName: string; unitId?: string },
  ): Promise<AddToListOutcome> => {
    if (!shoppingListId) return 'reverted';
    // Mint the id so a queued create replays idempotently, keyed by it.
    const id = generateEntityId();

    try {
      addOptimisticShoppingListItem(
        client.cache,
        shoppingListId,
        createOptimisticShoppingListItem(id, {
          shoppingListId,
          itemName: display.itemName,
          unitId: display.unitId,
        }),
      );
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Shopping List Item (optimistic)',
      });
    }

    let result;
    try {
      result = await addToShoppingList({
        variables: {
          input: { shoppingListId, items: [{ id, item: { itemId } }] },
        },
        context: { localFirst: true },
      });
    } catch {
      revertOptimisticShoppingListItem(client.cache, shoppingListId, id);
      return 'reverted';
    }

    // A queued create replays later — treat as success. `errorPolicy: 'all'`
    // resolves rejections, so the catch above never sees them; the reconciler
    // classifies the result and discards the item we wrote.
    return reconcileShoppingCreate(client.cache, shoppingListId, id, result);
  };

  return { addToList };
}

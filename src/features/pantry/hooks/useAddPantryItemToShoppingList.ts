import { useApolloClient, useMutation } from '@apollo/client/react';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/screens/FilteredPantryItems.generated';
import { buildAddItemsReconcileUpdate } from '#features/shoppingList/cache/items';
import { createShoppingListRow } from '#features/shoppingList/cache/createShoppingListRow';
import { useTranslation } from '#/i18n';

/** Whether the row survived. The caller owns the copy for a failure. */
export type AddToListOutcome = 'kept' | 'reverted';

/**
 * Put one pantry item on a shopping list. The row is written before firing so it
 * survives a queued create, and withdrawn on a refusal. The list is a per-call
 * argument because one screen adds a row to the list already selected and adds
 * every row to a list picked in the moment.
 */
export function useAddPantryItemToShoppingList() {
  const client = useApolloClient();
  const { t } = useTranslation();

  const [addToShoppingList] = useMutation(
    AddItemToShoppingListFromFilteredPantryDocument,
    {
      // Reads the list id from the mutation's own variables, so it stays
      // correct across re-renders.
      update: buildAddItemsReconcileUpdate({}),
    },
  );

  const addToList = async (
    shoppingListId: string | null | undefined,
    itemId: string,
    display: { itemName: string; unitId?: string },
  ): Promise<AddToListOutcome> => {
    if (!shoppingListId) return 'reverted';
    const { outcome } = await createShoppingListRow(client.cache, {
      listId: shoppingListId,
      row: { itemName: display.itemName, itemId, unitId: display.unitId },
      line: { item: { itemId } },
      send: addToShoppingList,
      document: AddItemToShoppingListFromFilteredPantryDocument,
      fallback: t('errors.addItemFailed'),
    });
    return outcome;
  };

  return { addToList };
}

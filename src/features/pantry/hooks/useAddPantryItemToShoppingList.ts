import { useAddShoppingRows } from '#features/shoppingList/hooks/useAddShoppingRows';
import { useTranslation } from '#/i18n';

/** Whether the row survived. The caller owns the copy for a failure. */
export type AddToListOutcome = 'kept' | 'reverted';

/**
 * Puts one pantry item on a shopping list, held until the server answers. The
 * list is per call, since one screen adds a row to the selected
 * list and every row to a list picked in the moment.
 */
export function useAddPantryItemToShoppingList() {
  const { t } = useTranslation();
  const { addRow } = useAddShoppingRows();

  const addToList = async (
    shoppingListId: string | null | undefined,
    itemId: string,
    display: { itemName: string; unitId?: string },
  ): Promise<AddToListOutcome> => {
    if (!shoppingListId) return 'reverted';
    const { outcome } = await addRow({
      listId: shoppingListId,
      row: { itemName: display.itemName, unitId: display.unitId },
      line: { item: { itemId } },
      fallback: t('errors.addItemFailed'),
    });
    return outcome;
  };

  return { addToList };
}

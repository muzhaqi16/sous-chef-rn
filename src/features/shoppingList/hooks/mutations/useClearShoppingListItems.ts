/**
 * Local-first: the rows are hidden until the server answers the single batch
 * remove, so the clear survives an offline queue.
 */

import { useRef } from 'react';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';
import type { RemoveRowsInputs } from '#entities/shoppingList/localWrites';
import { removeItemsFromShoppingListWrite } from '#features/shoppingList/offline/localWrites';

// The hook only reads `id` and the array length from the item lists.
interface ClearableItem {
  id: string;
}

interface UseClearShoppingListItemsOptions {
  listId: string | null | undefined;
  unpurchasedItems: ClearableItem[];
  purchasedItems: ClearableItem[];
}

export function useClearShoppingListItems({
  listId,
  unpurchasedItems,
  purchasedItems,
}: UseClearShoppingListItemsOptions) {
  const { t } = useTranslation();
  const isClearingRef = useRef(false);

  const clear = useLocalWrite(removeItemsFromShoppingListWrite, {
    fallback: t('shoppingListScreens.failedToClear'),
  });

  const clearItems = async (purchased: boolean) => {
    if (!listId || isClearingRef.current) return;

    const targetItems = purchased ? purchasedItems : unpurchasedItems;
    if (targetItems.length === 0) return;

    isClearingRef.current = true;
    const itemIds = targetItems.map(i => i.id);

    const inputs: RemoveRowsInputs = { listId };
    // The EXACT ids captured at tap time, not a purchased filter: a queued replay
    // then deletes only those and never a row another member added meanwhile.
    // Removing an already-removed id is a server-side no-op, so the replay is safe.
    await clear.send(
      { input: { shoppingListId: listId, ids: itemIds } },
      inputs,
    );
    isClearingRef.current = false;
  };

  return { clearItems };
}

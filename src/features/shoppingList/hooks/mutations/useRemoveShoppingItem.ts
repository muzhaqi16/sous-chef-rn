/**
 * Local-first: the row is hidden and the list's counts moved until the server
 * answers. The replay is idempotent by item id.
 */

import type { RemoveRowsInputs } from '#entities/shoppingList/localWrites';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';
import { removeItemFromShoppingListWrite } from '#features/shoppingList/offline/localWrites';

interface UseRemoveShoppingItemOptions {
  listId: string | null | undefined;
}

interface UseRemoveShoppingItemReturn {
  /** `true` once the row is gone or its removal is queued; `false` when refused. */
  removeItem: (itemId: string) => Promise<boolean>;
}

export function useRemoveShoppingItem({
  listId,
}: UseRemoveShoppingItemOptions): UseRemoveShoppingItemReturn {
  const { t } = useTranslation();

  const remove = useLocalWrite(removeItemFromShoppingListWrite, {
    fallback: t('errors.deleteItemFailed'),
    removal: true,
  });

  const removeItem = async (itemId: string): Promise<boolean> => {
    if (!listId) return false;

    const inputs: RemoveRowsInputs = { listId };
    const settled = await remove.send({ input: { id: itemId } }, inputs);
    return settled.status !== 'failed';
  };

  return { removeItem };
}

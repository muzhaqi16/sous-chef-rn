/**
 * Local-first: the row is hidden and the list's counts moved until the server
 * answers. The replay is idempotent by item id.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveItemFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { RemoveRowsInputs } from '#features/shoppingList/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

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
  const client = useApolloClient();
  const { t } = useTranslation();

  const [removeItemMutation] = useMutation(RemoveItemFromShoppingListDocument, {
    context: { localFirst: true },
  });

  const removeItem = async (itemId: string): Promise<boolean> => {
    if (!listId) return false;

    const inputs: RemoveRowsInputs = { listId };
    const settled = await pendingWritesOf(client.cache).send(
      RemoveItemFromShoppingListDocument,
      { input: { id: itemId } },
      write =>
        settleMutation(() => removeItemMutation(write), {
          document: RemoveItemFromShoppingListDocument,
          fallback: t('errors.deleteItemFailed'),
          removal: true,
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  return { removeItem };
}

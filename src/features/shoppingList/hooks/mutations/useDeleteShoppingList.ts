/**
 * Local-first: the list leaves the cache PERMANENTLY before firing, so the delete
 * survives an offline queue — a list already gone counts as deleted. A failure
 * restores the snapshot (items repopulate on refetch).
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addOptimisticShoppingList,
  readShoppingListSnapshot,
  removeShoppingListFromCache,
} from '#features/shoppingList/cache/list';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

export function useDeleteShoppingList() {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [mutate] = useMutation(DeleteShoppingListDocument);

  /** `true` once the list is gone or its delete is queued; `false` when refused. */
  const deleteShoppingList = async (id: string): Promise<boolean> => {
    // Snapshot first so a server rejection can restore the list.
    const snapshot = readShoppingListSnapshot(client.cache, id);

    try {
      removeShoppingListFromCache(client.cache, id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Shopping List (optimistic)',
      });
    }

    const restore = () => {
      if (!snapshot) return;
      try {
        addOptimisticShoppingList(client.cache, snapshot);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Restore refused Shopping List delete',
        });
      }
    };

    // Toasted rather than alerted: the list simply reappears where it was.
    const settled = await settleMutation(
      () =>
        mutate({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      {
        document: DeleteShoppingListDocument,
        fallback: t('errors.deleteShoppingListFailed'),
        removal: true,
        onFailed: restore,
        present: 'none',
      },
    );
    if (settled.failure) toastService.error(settled.failure.body);
    return settled.status !== 'failed';
  };

  return { deleteShoppingList };
}

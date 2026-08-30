/**
 * useDeleteShoppingList - Delete a shopping list (local-first).
 *
 * Removes the list from the cache BEFORE firing (overview edge + entity), so
 * the deletion sticks when the request is queued offline — the replay deletes
 * server-side, and a duplicate replay surfaces as NotFound, which the queue
 * drops. A server rejection restores the snapshotted list (its items
 * repopulate on the next visit's refetch).
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addOptimisticShoppingList,
  readShoppingListSnapshot,
  removeShoppingListFromCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { toastService } from '#/services/toastService';
import { errorService, localizedErrorMessage } from '#/services/errorService';
import { t } from '#/i18n';

export function useDeleteShoppingList() {
  const client = useApolloClient();

  const [mutate, { loading }] = useMutation(DeleteShoppingListDocument, {
    onError: error => {
      // Resolved from the error's CODE, never from the server's message — that
      // text is English by construction and would reach every non-English user
      // verbatim, under a translated title.
      toastService.error(
        localizedErrorMessage(error, t('errors.deleteShoppingListFailed')),
      );
    },
  });

  const deleteShoppingList = async (id: string) => {
    // Snapshot first so a server rejection can restore the list.
    const snapshot = readShoppingListSnapshot(client.cache, id);

    // Local-first: remove from the cache BEFORE firing, so the deletion is
    // visible immediately and survives an offline queue.
    try {
      removeShoppingListFromCache(client.cache, id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Shopping List (optimistic)',
      });
    }

    let result;
    try {
      result = await mutate({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Delete Shopping List error:',
      });
    }

    // 'queued' (null payload, no error) keeps the removal — the delete replays
    // later. A rejection restores the snapshot; without one (incomplete cache
    // copy) the next overview refetch restores the authoritative state.
    const rejected = classifyCreateResult(result) === 'rejected';
    if (rejected && snapshot) {
      try {
        addOptimisticShoppingList(client.cache, snapshot);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Restore refused Shopping List delete',
        });
      }
    }
    return result;
  };

  return { deleteShoppingList, loading };
}

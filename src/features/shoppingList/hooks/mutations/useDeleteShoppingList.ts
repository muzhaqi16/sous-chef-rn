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
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { getErrorMessage } from '#/services/errorService';

export function useDeleteShoppingList() {
  const client = useApolloClient();

  const [mutate, { loading }] = useMutation(DeleteShoppingListDocument, {
    onError: error => {
      toastService.error(getErrorMessage(error));
    },
  });

  const deleteShoppingList = async (id: string) => {
    // Snapshot first so a server rejection can restore the list.
    const snapshot = readShoppingListSnapshot(client.cache, id);

    // Local-first: remove from the cache BEFORE firing, so the deletion is
    // visible immediately and survives an offline queue.
    executeCacheUpdate(
      () => removeShoppingListFromCache(client.cache, id),
      'Delete Shopping List (optimistic)',
    );

    const result = await executeMutation(
      () =>
        mutate({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      'Delete Shopping List error:',
    );

    // 'queued' (null payload, no error) keeps the removal — the delete replays
    // later. A rejection restores the snapshot; without one (incomplete cache
    // copy) the next overview refetch restores the authoritative state.
    const rejected =
      !result ||
      classifyCreateResult(
        result,
        'deleteShoppingList',
        'DeleteShoppingListPayload',
      ) === 'rejected';
    if (rejected && snapshot) {
      executeCacheUpdate(
        () => addOptimisticShoppingList(client.cache, snapshot),
        'Restore refused Shopping List delete',
      );
    }
    return result;
  };

  return { deleteShoppingList, loading };
}

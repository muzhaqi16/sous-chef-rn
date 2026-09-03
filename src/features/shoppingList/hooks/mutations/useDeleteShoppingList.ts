/**
 * Local-first: the list leaves the cache PERMANENTLY before firing, so the delete
 * survives an offline queue — a duplicate replay surfaces as NotFound, which the
 * queue drops. A rejection restores the snapshot (items repopulate on refetch).
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  DeleteShoppingListDocument,
  type DeleteShoppingListMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addOptimisticShoppingList,
  readShoppingListSnapshot,
  removeShoppingListFromCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';
import { toastService } from '#/services/toastService';
import { errorService, localizedErrorMessage } from '#/services/errorService';
import { t } from '#/i18n';

export function useDeleteShoppingList() {
  const client = useApolloClient();

  const [mutate, { loading }] = useMutation(DeleteShoppingListDocument, {
    onError: error => {
      // Resolved from the error's CODE: the server's `message` is unlocalizable
      // English by construction and must never be displayed.
      toastService.error(
        localizedErrorMessage(error, t('errors.deleteShoppingListFailed')),
      );
    },
  });

  const deleteShoppingList = async (
    id: string,
  ): Promise<MutationOutcome<DeleteShoppingListMutation> | undefined> => {
    // Snapshot first so a server rejection can restore the list.
    const snapshot = readShoppingListSnapshot(client.cache, id);

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

    // 'queued' (null payload, no error) keeps the removal and replays later. A
    // rejection restores the snapshot, or the next overview refetch does.
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

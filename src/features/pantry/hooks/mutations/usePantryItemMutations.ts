/**
 * usePantryItemMutations - update/remove mutations for pantry items
 *
 * Single responsibility:
 * - Update and remove mutations
 * - Optimistic responses for instant UI
 * - Cache updates for offline-first support
 *
 * Adds do NOT live here: every add surface goes through `AddToPantrySheet` /
 * `usePantryItemSubmission` / `useCreatePantryItem`, which own the
 * DuplicatePantryItemError restock/force-add recovery flow the contract
 * requires on every add path.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import type { Unmasked } from '@apollo/client/masking';
import type { IgnoreModifier } from '@apollo/client/cache';
import {
  UpdatePantryItemDocument,
  DeletePantryItemDocument,
  type UpdatePantryItemMutation,
} from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItem_PantryItemFragmentDoc,
  type UseUpdatePantryItem_PantryItemFragment,
} from '#features/pantry/hooks/mutations/useUpdatePantryItem.generated';
import {
  enhanceWithVersion,
  buildOptimisticMutationResponse,
} from '#/apollo/utils/createOptimisticResponse';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { isNetworkError } from '#/utils/isNetworkError';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  removeFromPantryItemsCache,
  adjustPantryItemCount,
} from '#/apollo/utils/pantryCacheUpdaters';
import type { PantryItemUpdate } from '../pantryDataTypes';
import { errorService } from '#/services/errorService';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t as tGlobal } from '#/i18n';

interface UsePantryItemMutationsOptions {
  pantryId: string | undefined;
  refetch: () => void;
}

/**
 * Hook for pantry item update/remove operations
 *
 * @example
 * ```tsx
 * const { updateItem, removeItem } = usePantryItemMutations({
 *   pantryId,
 *   refetch,
 * });
 * ```
 */
export function usePantryItemMutations({
  pantryId,
  refetch,
}: UsePantryItemMutationsOptions) {
  const { createUpdateOperation } = useCrudOperations();
  const client = useApolloClient();

  // UPDATE MUTATION
  const [updateItemMutation] = useMutation(UpdatePantryItemDocument, {
    onError: error => {
      handleMutationError(error, {
        operation: 'Update Pantry Item',
        checks: [versionConflictCheck({ onRefresh: () => refetch() })],
      });
    },
    // The operation's fragment spread stays masked (no `@unmask` directive); this
    // callback annotates its OWN return type as `Unmasked<UpdatePantryItemMutation>`
    // so it can return the flat, unmasked shape Apollo's optimisticResponse needs.
    optimisticResponse: (
      variables,
      { IGNORE },
    ): IgnoreModifier | Unmasked<UpdatePantryItemMutation> => {
      const currentItem =
        client.cache.readFragment<UseUpdatePantryItem_PantryItemFragment>({
          id: client.cache.identify({
            __typename: 'PantryItem',
            id: variables.input.id,
          }),
          fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
          fragmentName: 'useUpdatePantryItem_pantryItem',
        });
      if (!currentItem) return IGNORE;

      return buildOptimisticMutationResponse(
        'updatePantryItem',
        'UpdatePantryItemPayload',
        {
          pantryItem: enhanceWithVersion(
            currentItem,
            // Input types use InputMaybe (T | null | undefined) while fragment
            // types don't accept null — safe cast for optimistic prediction.
            variables.input as Partial<UseUpdatePantryItem_PantryItemFragment>,
          ),
          pantry: null,
        },
      );
    },
  });

  // REMOVE MUTATION. `removeItem` evicts the item from the cache before this
  // fires and leaves it evicted, so the removal persists if the delete is queued
  // offline or the API is unreachable. An `optimisticResponse` can't be used:
  // Apollo would roll it back the moment the request is queued (null result). The
  // `update` below re-evicts on the server response to clean up the entity Apollo
  // re-normalizes from the `deletePantryItem.pantryItem { id }` payload.
  const [removeItemMutation] = useMutation(DeletePantryItemDocument, {
    onError: error => {
      // Network/transient error: queueLink queued the delete for replay
      // (SyncDeletePantryItem, idempotent by real id) — keep the optimistic
      // eviction; do NOT restore.
      if (isNetworkError(error)) return;
      // Real (server/validation) error: the item still exists server-side →
      // restore it via refetch.
      handleMutationError(error, { operation: 'Remove Pantry Item' });
      refetch();
    },
    update: (cache, { data }, { variables }) => {
      if (
        data?.deletePantryItem?.__typename !== 'DeletePantryItemPayload' ||
        !pantryId ||
        !variables
      ) {
        return;
      }

      const itemId = variables.input.id;
      // Connection removal only. The count is adjusted beside the pre-fire
      // evict below, which runs whether or not the delete reaches the server —
      // doing it here as well double-counted online, where both paths run.
      removeFromPantryItemsCache(cache, pantryId, itemId, { evictItem: true });
    },
  });

  // WRAPPED OPERATIONS

  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    const operation = createUpdateOperation({
      mutation: updateItemMutation,
      parentId: () => pantryId,
      itemId,
      onSuccess: (data: UpdatePantryItemMutation) =>
        data?.updatePantryItem?.__typename === 'UpdatePantryItemPayload'
          ? data.updatePantryItem.pantryItem
          : undefined,
      onVersionConflict: refetch,
      operationName: 'Update Pantry Item',
    });
    return operation(updates);
  };

  /** @returns whether the item is gone — false when the server refused it. */
  const removeItem = async (itemId: string): Promise<boolean> => {
    if (!pantryId) {
      return false;
    }

    // Evict the item from the cache before firing, and leave it evicted, so the
    // removal persists if the delete is queued offline (the queue replays it,
    // idempotent by this id).
    try {
      removeFromPantryItemsCache(client.cache, pantryId, itemId, {
        evictItem: true,
      });
      adjustPantryItemCount(client.cache, pantryId, -1);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Remove Pantry Item (optimistic evict)',
      });
    }

    // Register pending delete to handle subscription race condition
    subscriptionService.registerPendingDelete(
      itemId,
      pantryId,
      'PantryItem',
      'Pantry',
      'itemsConnection',
    );

    let result;
    try {
      result = await removeItemMutation({
        variables: { input: { id: itemId } },
        context: { localFirst: true },
      });
    } catch (error) {
      subscriptionService.unregisterPendingDelete(itemId);
      throw error;
    }
    if (result) {
      subscriptionService.unregisterPendingDelete(itemId);

      // `errorPolicy: 'all'` resolves a refusal as DATA — a non-success union
      // member — so it never reaches `onError`. The row was evicted and the
      // count dropped before firing, and the server still has the item, so the
      // refusal has to put both back. A transport failure is the opposite case
      // and is handled in `onError`: the delete is queued, so the eviction
      // stands.
      const payload = result.data?.deletePantryItem;
      if (payload && payload.__typename !== 'DeletePantryItemPayload') {
        // And SAY so. Restoring the row without a word reads as the delete
        // having silently undone itself: the caller navigates away on a
        // successful return, so a refusal that returns normally looks exactly
        // like success until the row reappears. `alertRejectedMutation` (not
        // `alertIfRejected`) because this mutation keeps an `onError` for the
        // transport case, and the two must not double-alert.
        alertRejectedMutation(result, tGlobal('errors.deleteItemFailed'));
        refetch();
        return false;
      }
    }
    return true;
  };

  return {
    updateItem,
    removeItem,
  };
}

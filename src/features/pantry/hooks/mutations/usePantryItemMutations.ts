/**
 * Removal only. Edits go through `useUpdatePantryItem`; adds go through
 * `AddToPantrySheet` / `usePantryItemSubmission`, which own the
 * DuplicatePantryItemError restock/force-add recovery every add path requires.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  removeFromPantryItemsCache,
  adjustPantryItemCount,
} from '#features/pantry/cache/items';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

interface UsePantryItemMutationsOptions {
  pantryId: string | undefined;
  refetch: () => void;
}

export function usePantryItemMutations({
  pantryId,
  refetch,
}: UsePantryItemMutationsOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();

  // REMOVE MUTATION. `removeItem` evicts the item before this fires and leaves
  // it evicted, so a queued delete keeps the removal (an `optimisticResponse`
  // would roll back on the queue's null result). `update` re-evicts the entity
  // Apollo re-normalizes from the `deletePantryItem.pantryItem { id }` payload.
  const [removeItemMutation] = useMutation(DeletePantryItemDocument, {
    update: (cache, { data }, { variables }) => {
      if (!appliedPayload(data) || !pantryId || !variables) {
        return;
      }

      const itemId = variables.input.id;
      // Connection removal only. The count is adjusted beside the pre-fire
      // evict below, which runs whether or not the delete reaches the server —
      // doing it here as well double-counted online, where both paths run.
      removeFromPantryItemsCache(cache, pantryId, itemId, { evictItem: true });
    },
  });

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

    // A refusal leaves the row on the server, so the refetch puts back the row
    // and count evicted above; the caller navigates away only on `true`.
    const settled = await settleMutation(
      () =>
        removeItemMutation({
          variables: { input: { id: itemId } },
          context: { localFirst: true },
        }),
      {
        document: DeletePantryItemDocument,
        fallback: t('errors.deleteItemFailed'),
        removal: true,
        onFailed: refetch,
      },
    );
    subscriptionService.unregisterPendingDelete(itemId);
    return settled.status !== 'failed';
  };

  return { removeItem };
}

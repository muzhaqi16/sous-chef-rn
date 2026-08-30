/**
 * Local-first: the corrected count is written to the cache PERMANENTLY before
 * firing — an `optimisticResponse` rolls back on the offline queue's null
 * result. The server writes an ADJUSTMENT ledger row per adjust, so
 * `input.idempotencyKey` is what keeps a queued replay from double-counting.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { AdjustPantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
  type UseAdjustPantryItemQuantity_PantryItemFragment,
} from './useAdjustPantryItemQuantity.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import {
  handleMutationError,
  versionConflictCheck,
  invalidUnitCheck,
} from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

interface UseAdjustPantryItemQuantityOptions {
  onSuccess?: () => void;
}

export function useAdjustPantryItemQuantity({
  onSuccess,
}: UseAdjustPantryItemQuantityOptions = {}) {
  const client = useApolloClient();

  const [adjustMutation, { loading }] = useMutation(
    AdjustPantryItemQuantityDocument,
    {
      onError: error => {
        handleMutationError(error, {
          operation: 'Adjust Quantity',
          checks: [versionConflictCheck(), invalidUnitCheck()],
        });
      },
    },
  );

  const adjustQuantity = async (
    pantryItemId: string,
    newQuantity: number,
    reason: string,
    version: number,
    remainingNetWeight?: number,
  ): Promise<boolean> => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: pantryItemId,
    });
    const currentItem =
      client.cache.readFragment<UseAdjustPantryItemQuantity_PantryItemFragment>(
        {
          id: cacheId,
          fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
        },
      );

    const writeItem = (data: UseAdjustPantryItemQuantity_PantryItemFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
        fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
        data,
      });

    // Permanent optimistic write before firing — newQuantity is absolute (a
    // physical recount), so set it directly. Persist it too so the exact value
    // survives an app-kill before the queue replays.
    if (currentItem) {
      const optimistic = enhanceWithVersion(currentItem, {
        quantity: newQuantity,
        ...(remainingNetWeight != null ? { remainingNetWeight } : {}),
      });
      try {
        writeItem(optimistic);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Adjust Pantry Item Quantity (optimistic)',
        });
      }
      optimisticDataPersistence.save(
        'PantryItem',
        pantryItemId,
        'quantity',
        newQuantity,
      );
    }

    // idempotencyKey dedups the ADJUSTMENT ledger entry on replay. `version` is
    // the optimistic-concurrency check the server now requires.
    const result = await adjustMutation({
      variables: {
        input: {
          id: pantryItemId,
          newQuantity,
          reason,
          idempotencyKey: generateEntityId(),
          version,
          ...(remainingNetWeight != null ? { remainingNetWeight } : {}),
        },
      },
      context: { localFirst: true },
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // Server refused the adjust — restore the pre-adjust snapshot. A transport
      // error already alerted via onError; a non-success union payload
      // (Validation/Forbidden/NotFound/Conflict) has no error, so alert here.
      if (currentItem) {
        try {
          writeItem(currentItem);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected pantry quantity adjust',
          });
        }
      }
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'quantity');
      alertRejectedMutation(result, t('errors.adjustQuantityFailed'));
      return false;
    }

    // created (server confirmed, response normalized the authoritative value)
    // or queued (offline / API down — replays the canonical mutation, deduped
    // by its idempotencyKey).
    if (outcome === 'created') {
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'quantity');
    }
    onSuccess?.();
    return true;
  };

  return { adjustQuantity, loading };
}

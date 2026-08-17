/**
 * useAdjustPantryItemQuantity - Mutation hook for adjusting pantry item quantity
 * (local-first).
 *
 * Adjusts pantry item quantity to match a physical count and creates an
 * ADJUSTMENT usage record with a mandatory reason for the audit trail.
 *
 * The corrected count is written to the cache PERMANENTLY before firing (an
 * `optimisticResponse` would roll back the moment the offline queue completes
 * the request with a null result), so it shows instantly and survives an
 * offline/API-down adjust. Because the server writes a ledger row per adjust, a
 * naive replay would double-count — so the canonical mutation carries a
 * client-minted `input.idempotencyKey` that the server records in the same
 * transaction, so a replay applies the delta exactly once (it returns
 * ConflictError(IDEMPOTENT_REPLAY), which the queue converges). A real rejection
 * restores the pre-adjust snapshot.
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
    version?: number,
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

    // idempotencyKey dedups the ADJUSTMENT ledger entry on replay.
    const result = await adjustMutation({
      variables: {
        input: {
          id: pantryItemId,
          newQuantity,
          reason,
          idempotencyKey: generateEntityId(),
          ...(version != null ? { version } : {}),
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

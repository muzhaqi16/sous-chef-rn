/**
 * useCorrectPantryItemWeight — correct a pantry item's net weight (local-first).
 *
 * Used after an item has been used (`lastUsedAt` is set). Creates a
 * WEIGHT_CORRECTED audit record with a mandatory reason.
 *
 * The corrected weight is written to the cache PERMANENTLY before firing (an
 * `optimisticResponse` would roll back the moment the offline queue completes
 * the request with a null result), so it shows instantly and survives an
 * offline/API-down correction. The server writes a ledger row per correction,
 * so a naive replay would write the audit twice — the mutation therefore
 * carries a client-minted `input.idempotencyKey` that the server records in the
 * same transaction, making a replay apply exactly once (it answers
 * `ConflictError(IDEMPOTENT_REPLAY)`, which the queue converges). A real
 * rejection restores the pre-correction snapshot.
 *
 * `version` rides along as the optimistic-concurrency check; a replay that
 * loses the race is a genuine conflict and is surfaced, not swallowed.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { AdjustPantryItemWeightDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseCorrectPantryItemWeight_PantryItemFragmentDoc,
  type UseCorrectPantryItemWeight_PantryItemFragment,
} from './useCorrectPantryItemWeight.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import {
  handleMutationError,
  versionConflictCheck,
  invalidUnitCheck,
} from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';

interface UseCorrectPantryItemWeightOptions {
  onSuccess?: () => void;
}

export function useCorrectPantryItemWeight({
  onSuccess,
}: UseCorrectPantryItemWeightOptions = {}) {
  const client = useApolloClient();

  const [correctMutation, { loading }] = useMutation(
    AdjustPantryItemWeightDocument,
    {
      onError: error => {
        handleMutationError(error, {
          operation: 'Correct Weight',
          checks: [versionConflictCheck(), invalidUnitCheck()],
        });
      },
    },
  );

  const correctWeight = async (
    pantryItemId: string,
    netWeight: number,
    reason: string,
    version: number,
    netWeightUnitId?: string,
  ): Promise<boolean> => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: pantryItemId,
    });
    const currentItem =
      client.cache.readFragment<UseCorrectPantryItemWeight_PantryItemFragment>({
        id: cacheId,
        fragment: UseCorrectPantryItemWeight_PantryItemFragmentDoc,
        fragmentName: 'useCorrectPantryItemWeight_pantryItem',
      });

    const writeItem = (data: UseCorrectPantryItemWeight_PantryItemFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseCorrectPantryItemWeight_PantryItemFragmentDoc,
        fragmentName: 'useCorrectPantryItemWeight_pantryItem',
        data,
      });

    // The correction is absolute (a physical re-weigh), so set it directly.
    // Persist it too, so the exact value survives an app-kill before replay.
    // The unit is deliberately NOT changed locally: `netWeightUnitId` only
    // names a unit id, and inventing a `netWeightUnit` object from it would
    // write a half-populated Unit into the cache. The server's response fills
    // it in.
    if (currentItem) {
      const optimistic = enhanceWithVersion(currentItem, { netWeight });
      try {
        writeItem(optimistic);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Correct Pantry Item Weight (optimistic)',
        });
      }
      optimisticDataPersistence.save(
        'PantryItem',
        pantryItemId,
        'netWeight',
        netWeight,
      );
    }

    const result = await correctMutation({
      variables: {
        input: {
          id: pantryItemId,
          netWeight,
          reason,
          version,
          idempotencyKey: generateEntityId(),
          ...(netWeightUnitId ? { netWeightUnitId } : {}),
        },
      },
      context: { localFirst: true },
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // Restore the pre-correction snapshot. A transport error already alerted
      // via onError; a non-success union member carries no error, so alert here.
      if (currentItem) {
        try {
          writeItem(currentItem);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected pantry weight correction',
          });
        }
      }
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'netWeight');
      alertRejectedMutation(result, t('errors.correctWeightFailed'));
      return false;
    }

    // 'created' (server confirmed, the response normalized the authoritative
    // value) or 'queued' (offline / API down — replays the canonical mutation,
    // deduped by its idempotencyKey).
    if (outcome === 'created') {
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'netWeight');
    }
    onSuccess?.();
    return true;
  };

  return { correctWeight, loading };
}

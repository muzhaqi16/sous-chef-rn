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

import { useMutation } from '@apollo/client/react';
import { AdjustPantryItemWeightDocument } from '#features/pantry/graphql/pantry.generated';
import {
  handleMutationError,
  versionConflictCheck,
  invalidUnitCheck,
} from '#/utils/errorHandlers';
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { t } from '#/i18n';

interface UseCorrectPantryItemWeightOptions {
  onSuccess?: () => void;
}

export function useCorrectPantryItemWeight({
  onSuccess,
}: UseCorrectPantryItemWeightOptions = {}) {
  const { apply } = useWrite();

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
    // The correction is absolute (a physical re-weigh), so it sets the value
    // directly. The unit is deliberately NOT changed locally: `netWeightUnitId`
    // only names a unit id, and inventing a `netWeightUnit` object from it would
    // write a half-populated Unit into the cache. The server's response fills
    // it in.
    const { context, revert } = apply({
      target: { __typename: 'PantryItem', id: pantryItemId },
      patch: { netWeight },
      convergence: 'absolute',
    });

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
      context,
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // Refused on the spot, so it never entered the queue and the queue's
      // withdrawal will never see it. A queued write refused on a later replay
      // is undone from its persisted intent instead.
      revert();
      alertRejectedMutation(result, t('errors.correctWeightFailed'));
      return false;
    }

    onSuccess?.();
    return true;
  };

  return { correctWeight, loading };
}

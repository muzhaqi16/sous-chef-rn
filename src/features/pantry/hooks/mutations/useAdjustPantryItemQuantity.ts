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

import { useMutation } from '@apollo/client/react';
import { AdjustPantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import {
  handleMutationError,
  versionConflictCheck,
  invalidUnitCheck,
} from '#/utils/errorHandlers';
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';

interface UseAdjustPantryItemQuantityOptions {
  onSuccess?: () => void;
}

export function useAdjustPantryItemQuantity({
  onSuccess,
}: UseAdjustPantryItemQuantityOptions = {}) {
  const { apply } = useWrite();

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
    // The corrected count is absolute (a physical recount), so it sets the
    // value directly rather than adjusting by a delta.
    const { context, revert } = apply({
      target: { __typename: 'PantryItem', id: pantryItemId },
      patch: {
        quantity: newQuantity,
        ...(remainingNetWeight != null ? { remainingNetWeight } : {}),
      },
      convergence: 'absolute',
    });

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
      context,
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // Refused on the spot, so it never entered the queue. A queued write
      // refused on a later replay is undone from its persisted intent.
      revert();
      alertRejectedMutation(result, t('errors.adjustQuantityFailed'));
      return false;
    }

    onSuccess?.();
    return true;
  };

  return { adjustQuantity, loading };
}

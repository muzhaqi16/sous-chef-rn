/**
 * useConvertExpiredToWaste - Mutation hook for discarding an expired pantry item
 * (local-first).
 *
 * Converts an expired pantry item to waste in one step: sets `condition` to
 * SPOILED, creates a WASTE usage record with wasteReason=EXPIRED, and sets
 * `quantity` to 0. The local change is declared once as a `WriteIntent` — the
 * kit applies it permanently before firing (so it reads as discarded instantly
 * and survives an offline/queued conversion), derives what undoes it from what
 * the cache actually held, and carries that to the queue so a withdrawal after
 * a restart still restores the item.
 *
 * Because the server writes a waste ledger row, a naive replay would
 * double-count — so the canonical mutation carries a client-minted
 * `input.idempotencyKey`; the server records it in the same transaction as the
 * conversion, so a queued replay applies it exactly once (it returns
 * ConflictError(IDEMPOTENT_REPLAY), which the queue converges).
 */

import { useMutation } from '@apollo/client/react';
import { ConvertExpiredToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { ItemCondition } from '#/graphql/generated/schemaTypes';
import { handleMutationError } from '#/utils/errorHandlers';
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { t } from '#/i18n';

interface UseConvertExpiredToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredToWaste({
  onSuccess,
}: UseConvertExpiredToWasteOptions = {}) {
  const { apply } = useWrite();
  const [convertMutation, { loading }] = useMutation(
    ConvertExpiredToWasteDocument,
    {
      onError: error => {
        handleMutationError(error, { operation: 'Convert Expired To Waste' });
      },
    },
  );

  const convertExpiredToWaste = async (
    pantryItemId: string,
  ): Promise<boolean> => {
    // Discarding sets a final state — quantity 0, SPOILED — rather than moving
    // either by an amount, so a version conflict is resolved by re-sending
    // against a fresh version. The waste ledger row that makes a re-send
    // dangerous is deduped server-side on `idempotencyKey`, not by holding the
    // write back.
    const { context, revert } = apply({
      target: { __typename: 'PantryItem', id: pantryItemId },
      patch: { quantity: 0, condition: ItemCondition.Spoiled },
      convergence: 'absolute',
    });

    const result = await convertMutation({
      variables: {
        input: { pantryItemId, idempotencyKey: generateEntityId() },
      },
      context,
    });

    // `classifyCreateResult` folds BOTH refusal channels into `'rejected'` — a
    // non-success union payload (HTTP 200, no `error`) and a resolved transport
    // error — so one branch undoes both. Refused on the spot means it never
    // entered the queue and the queue's withdrawal will never see it; a queued
    // write refused on a later replay is undone from its persisted intent.
    if (classifyCreateResult(result) === 'rejected') {
      revert();
      // Suppresses itself when `result.error` is set, where the mutation's
      // `onError` is the one reporter.
      alertRejectedMutation(result, t('errors.discardExpiredFailed'));
      return false;
    }

    // created (response normalized the authoritative item) or queued (replays
    // the canonical mutation, deduped by its idempotencyKey).
    onSuccess?.();
    return true;
  };

  return { convertExpiredToWaste, loading };
}

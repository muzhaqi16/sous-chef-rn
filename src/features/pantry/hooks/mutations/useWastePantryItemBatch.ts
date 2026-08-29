/**
 * useWastePantryItemBatch - Mutation hook for wasting a specific batch
 * (local-first).
 *
 * Marks the cached batch's `status` as WASTED PERMANENTLY before firing so the
 * batch shows as wasted instantly and survives an offline/queued waste. Because
 * the server writes a waste ledger row, a naive replay would double-count — so
 * the canonical mutation carries a client-minted `input.idempotencyKey`; the
 * server records it in the same transaction as the waste, making a queued
 * replay apply it exactly once (it returns ConflictError(IDEMPOTENT_REPLAY),
 * which the queue converges). A real rejection restores the pre-waste status.
 * The parent item's quantity / active-batch count catch up from the server
 * response on replay.
 */

import { useMutation } from '@apollo/client/react';
import { WastePantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { BatchStatus, type WasteReason } from '#/graphql/generated/schemaTypes';
import { handleMutationError } from '#/utils/errorHandlers';
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';

interface UseWastePantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useWastePantryItemBatch({
  onSuccess,
}: UseWastePantryItemBatchOptions = {}) {
  const [wasteMutation, { loading }] = useMutation(
    WastePantryItemBatchDocument,
    {
      onError: error => {
        handleMutationError(error, { operation: 'Waste Batch' });
      },
    },
  );

  const { apply } = useWrite();

  const wasteBatch = async (
    batchId: string,
    wasteReason?: WasteReason,
    isComposted?: boolean,
    isRecycled?: boolean,
    notes?: string,
  ): Promise<boolean> => {
    // The persisted marker is gone with this: it named a typename no screen
    // registered for restoration, so it was written and never read. The intent
    // on the queue entry is the durable record now.
    const { context, revert } = apply({
      target: { __typename: 'PantryItemBatch', id: batchId },
      patch: { status: BatchStatus.Wasted },
      convergence: 'absolute',
    });

    const result = await wasteMutation({
      variables: {
        input: {
          batchId,
          wasteReason,
          isComposted,
          isRecycled,
          notes,
          idempotencyKey: generateEntityId(),
        },
      },
      context,
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      revert();
      alertRejectedMutation(result, t('errors.wasteBatchFailed'));
      return false;
    }

    // created (response normalized the authoritative batches) or queued
    // (replays the canonical mutation, deduped by its idempotencyKey).
    onSuccess?.();
    return true;
  };

  return { wasteBatch, loading };
}

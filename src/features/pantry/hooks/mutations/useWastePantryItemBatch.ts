/**
 * Local-first: the cached batch's `status` is set WASTED PERMANENTLY before
 * firing, so it survives an offline/queued waste. The server writes a waste
 * ledger row, so `input.idempotencyKey` is what keeps a queued replay from
 * double-counting; a real rejection restores the pre-waste status.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { WastePantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { BatchStatus, type WasteReason } from '#/graphql/generated/schemaTypes';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { handleMutationError } from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

interface UseWastePantryItemBatchOptions {
  onSuccess?: () => void;
}

const BATCH_STATUS_FRAGMENT = gql`
  fragment useWastePantryItemBatch_state on PantryItemBatch {
    id
    status
    quantity
    depletedAt
  }
`;

export function useWastePantryItemBatch({
  onSuccess,
}: UseWastePantryItemBatchOptions = {}) {
  const client = useApolloClient();
  const [wasteMutation, { loading }] = useMutation(
    WastePantryItemBatchDocument,
    {
      onError: error => {
        handleMutationError(error, { operation: 'Waste Batch' });
      },
    },
  );

  const wasteBatch = async (
    batchId: string,
    wasteReason?: WasteReason,
    isComposted?: boolean,
    isRecycled?: boolean,
    notes?: string,
  ): Promise<boolean> => {
    const batchCacheId = client.cache.identify({
      __typename: 'PantryItemBatch',
      id: batchId,
    });
    const snapshot = client.cache.readFragment<{
      status: BatchStatus;
      quantity: number | null;
      depletedAt: string | null;
    }>({
      id: batchCacheId,
      fragment: BATCH_STATUS_FRAGMENT,
      fragmentName: 'useWastePantryItemBatch_state',
    });

    // Wasting empties the batch, so the server returns it at zero with a
    // `depletedAt`. Writing only `status` left the row reading "3 bunch" with
    // no date under a Wasted badge until a refetch — and offline, for good.
    const writeState = (
      status: BatchStatus,
      quantity: number | null,
      depletedAt: string | null,
    ) =>
      client.cache.modify({
        id: batchCacheId,
        fields: {
          status: () => status,
          quantity: () => quantity,
          depletedAt: () => depletedAt,
        },
      });

    // Permanent optimistic write before firing — survives an offline/queued waste.
    const clearPersistence = optimisticDataPersistence.track(
      'PantryItemBatch',
      batchId,
      'status',
      BatchStatus.Wasted,
    );
    try {
      writeState(BatchStatus.Wasted, 0, new Date().toISOString());
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Waste Pantry Item Batch (optimistic)',
      });
    }

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
      context: { localFirst: true },
    });

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // Resolved before the try — a `??` inside a try body makes the React
      // Compiler bail out of this hook.
      const revertedStatus = snapshot?.status ?? BatchStatus.Active;
      const revertedQuantity = snapshot?.quantity ?? null;
      const revertedDepletedAt = snapshot?.depletedAt ?? null;
      try {
        writeState(revertedStatus, revertedQuantity, revertedDepletedAt);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected batch waste',
        });
      }
      clearPersistence();
      // onError covers transport errors; a non-success union payload has none.
      alertRejectedMutation(result, t('errors.wasteBatchFailed'));
      return false;
    }

    // created (response normalized the authoritative batches) or queued
    // (replays the canonical mutation, deduped by its idempotencyKey).
    if (outcome === 'created') {
      clearPersistence();
    }
    onSuccess?.();
    return true;
  };

  return { wasteBatch, loading };
}

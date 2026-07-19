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

import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { WastePantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { BatchStatus, type WasteReason } from '#/graphql/generated/schemaTypes';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { handleMutationError } from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n/t';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';

interface UseWastePantryItemBatchOptions {
  onSuccess?: () => void;
}

const BATCH_STATUS_FRAGMENT = gql`
  fragment useWastePantryItemBatch_state on PantryItemBatch {
    id
    status
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
    const snapshot = client.cache.readFragment<{ status: BatchStatus }>({
      id: batchCacheId,
      fragment: BATCH_STATUS_FRAGMENT,
      fragmentName: 'useWastePantryItemBatch_state',
    });

    const writeStatus = (status: BatchStatus) =>
      client.cache.modify({
        id: batchCacheId,
        fields: { status: () => status },
      });

    // Permanent optimistic write before firing — survives an offline/queued waste.
    const clearPersistence = optimisticDataPersistence.track(
      'PantryItemBatch',
      batchId,
      'status',
      BatchStatus.Wasted,
    );
    executeCacheUpdate(
      () => writeStatus(BatchStatus.Wasted),
      'Waste Pantry Item Batch (optimistic)',
    );

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

    const outcome = classifyCreateResult(
      result,
      'wastePantryItemBatch',
      'WastePantryItemBatchPayload',
    );

    if (outcome === 'rejected') {
      executeCacheUpdate(
        () => writeStatus(snapshot?.status ?? BatchStatus.Active),
        'Revert rejected batch waste',
      );
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

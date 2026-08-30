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
    try {
      writeStatus(BatchStatus.Wasted);
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
      try {
        writeStatus(revertedStatus);
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

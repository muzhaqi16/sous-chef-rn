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
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
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
  const { t } = useTranslation();
  const client = useApolloClient();
  const [wasteMutation] = useMutation(WastePantryItemBatchDocument);

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
    // `depletedAt`; writing `status` alone leaves the row showing its old amount.
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

    const revert = () => {
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
    };

    const settled = await settleMutation(
      () =>
        wasteMutation({
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
        }),
      {
        document: WastePantryItemBatchDocument,
        fallback: t('errors.wasteBatchFailed'),
        onFailed: revert,
      },
    );
    if (settled.status === 'failed') return false;

    // Applied: the response normalized the authoritative batches. Queued: the
    // persisted value stands until the replay lands.
    if (settled.status === 'applied') {
      clearPersistence();
    }
    onSuccess?.();
    return true;
  };

  return { wasteBatch };
}

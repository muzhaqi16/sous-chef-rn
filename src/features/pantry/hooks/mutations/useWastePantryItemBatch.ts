/**
 * Local-first: the batch shows as wasted until the server answers. The server
 * writes a waste ledger row, so `input.idempotencyKey` is what keeps a queued
 * replay from double-counting.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { WastePantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { BatchStatus, type WasteReason } from '#/graphql/generated/schemaTypes';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { useTranslation } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';

interface UseWastePantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useWastePantryItemBatch({
  onSuccess,
}: UseWastePantryItemBatchOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [wasteMutation] = useMutation(WastePantryItemBatchDocument, {
    context: { localFirst: true },
  });

  const wasteBatch = async (
    batchId: string,
    wasteReason?: WasteReason,
    isComposted?: boolean,
    isRecycled?: boolean,
    notes?: string,
  ): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'PantryItemBatch', id: batchId },
      // Wasting empties the batch, so the server returns it at zero with a
      // `depletedAt`; `status` alone leaves the row showing its old amount.
      fields: {
        status: BatchStatus.Wasted,
        quantity: 0,
        depletedAt: new Date().toISOString(),
      },
      variables: {
        today: todayKey(),
        input: {
          batchId,
          wasteReason,
          isComposted,
          isRecycled,
          notes,
          idempotencyKey: generateEntityId(),
        },
      },
      mutate: wasteMutation,
      settle: {
        document: WastePantryItemBatchDocument,
        fallback: t('errors.wasteBatchFailed'),
      },
    });
    if (settled.status === 'failed') return false;
    onSuccess?.();
    return true;
  };

  return { wasteBatch };
}

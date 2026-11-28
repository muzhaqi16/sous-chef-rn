import { useState } from 'react';
import { useTranslation } from '#i18n';
import type { SettleStatus } from '#apollo/utils/settleMutation';
import { UsagePurpose } from '#graphql/generated/schemaTypes';
import type { StatedWaste } from '#features/pantry/types';
import { useRecordPantryUsage } from '#features/pantry/hooks/mutations/useRecordPantryUsage';
import {
  useWastePantryItemBatch,
  type WastedBatch,
} from '#features/pantry/hooks/mutations/useWastePantryItemBatch';

/**
 * Throwing out from one batch: the waste sheet opened on it, and its confirm.
 * All it holds throws the batch out whole; less is a waste drawn from it.
 */
export function useBatchWaste() {
  const { t } = useTranslation();
  const [wastingBatchId, setWastingBatchId] = useState<string | null>(null);
  const { wasteBatch } = useWastePantryItemBatch();
  const { recordUsage } = useRecordPantryUsage();

  const confirmBatchWaste = async (
    batch: WastedBatch,
    { quantity, all, usageUnitId, ...details }: StatedWaste,
  ): Promise<SettleStatus> => {
    const status = all
      ? await wasteBatch(batch, details)
      : await recordUsage({
          pantryItemId: batch.pantryItemId,
          quantity,
          usageUnitId,
          batchId: batch.id,
          usage: {
            purpose: UsagePurpose.Waste,
            wasteReason: details.wasteReason,
            isComposted: details.isComposted,
            isRecycled: details.isRecycled,
            notes: details.notes || undefined,
          },
          fallback: t('errors.recordWasteFailedRetry'),
        });
    if (status !== 'failed') setWastingBatchId(null);
    return status;
  };

  return { wastingBatchId, setWastingBatchId, confirmBatchWaste };
}

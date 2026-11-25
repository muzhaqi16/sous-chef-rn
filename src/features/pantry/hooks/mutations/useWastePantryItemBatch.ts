/**
 * Local-first: the batch shows as wasted, and its stack as that much less,
 * until the server answers. The server writes a waste ledger row, so
 * `input.idempotencyKey` is what keeps a queued replay from double-counting.
 */

import { WastePantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import type { SettleStatus } from '#apollo/utils/settleMutation';
import type { WasteBatchInputs } from '#features/pantry/offline/localWrites';
import type { WasteReason } from '#graphql/generated/schemaTypes';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';
import { generateEntityId } from '#utils/generateEntityId';
import { todayKey } from '#utils/dateUtils';

/** A batch thrown out whole. */
export interface WastedBatch {
  id: string;
  pantryItemId: string;
  /** What it holds, in its stack's tracking unit. */
  quantity: number;
}

/** Why it went, as the waste sheet states it. */
interface BatchWasteDetails {
  wasteReason: WasteReason;
  isComposted: boolean;
  isRecycled: boolean;
  notes: string;
}

export function useWastePantryItemBatch() {
  const { t } = useTranslation();
  const waste = useLocalWrite(WastePantryItemBatchDocument, {
    fallback: t('errors.wasteBatchFailed'),
  });

  const wasteBatch = async (
    batch: WastedBatch,
    { wasteReason, isComposted, isRecycled, notes }: BatchWasteDetails,
  ): Promise<SettleStatus> => {
    const inputs: WasteBatchInputs = {
      pantryItemId: batch.pantryItemId,
      held: batch.quantity,
      now: new Date().toISOString(),
    };
    const settled = await waste.send(
      {
        today: todayKey(),
        input: {
          batchId: batch.id,
          wasteReason,
          isComposted,
          isRecycled,
          notes: notes || undefined,
          idempotencyKey: generateEntityId(),
        },
      },
      inputs,
    );
    return settled.status;
  };

  return { wasteBatch };
}

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { CreatePantryItemUsageDocument } from '#features/pantry/graphql/pantry.generated';
import {
  ErrorCode,
  UsagePurpose,
  type WasteReason,
} from '#/graphql/generated/schemaTypes';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import { heldQuantityOf } from '#features/pantry/cache/stock';
import type { DrawStockInputs } from '#features/pantry/offline/localWrites';

interface FinishStock {
  purpose: UsagePurpose;
  /** One package alone; the whole stack when null. */
  batchId: string | null;
  wasteReason?: WasteReason;
}

/** How a finish ended: recorded or queued, refused as nothing is left, or failed. */
export type FinishOutcome = 'recorded' | 'nothingLeft' | 'failed';

// Codes a finish is refused with when the stock it names is gone: used up, or
// the stack or package removed. Widened to string, as a failure's code is.
const NOTHING_LEFT: ReadonlySet<string> = new Set([
  ErrorCode.InsufficientQuantity,
  ErrorCode.NotFound,
]);

/**
 * Records everything a stack, or one of its packages, still holds as used or
 * wasted, in one tap: the server takes `amount: { all: true }`.
 */
export function useFinishStock() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [createPantryItemUsage] = useMutation(CreatePantryItemUsageDocument, {
    context: { localFirst: true },
  });

  /** A queued write is not a failure; nothing left to finish is no failure either. */
  const finishStock = async (
    pantryItemId: string,
    { purpose, batchId, wasteReason }: FinishStock,
  ): Promise<FinishOutcome> => {
    const gone = {
      title: t('errors.stockAlreadyGoneTitle'),
      body: t('errors.stockAlreadyGone'),
    };
    const today = todayKey();
    // A package's share of the stack is the server's to work out, so only a
    // whole stack moves before the answer.
    const held = batchId ? null : heldQuantityOf(client.cache, pantryItemId);
    const inputs: DrawStockInputs = {
      delta: held === null ? null : -held,
      now: new Date().toISOString(),
    };
    const settled = await pendingWritesOf(client.cache).send(
      CreatePantryItemUsageDocument,
      {
        today,
        input: {
          pantryItemId,
          amount: { all: true },
          purpose,
          ...(batchId ? { targetBatchId: batchId } : {}),
          ...(wasteReason ? { wasteReason } : {}),
          today,
          // Dedups the usage ledger row on replay.
          idempotencyKey: generateEntityId(),
        },
      },
      write =>
        settleMutation(() => createPantryItemUsage(write), {
          document: CreatePantryItemUsageDocument,
          fallback:
            purpose === UsagePurpose.Waste
              ? t('errors.recordWasteFailedRetry')
              : t('errors.recordUsageFailedRetry'),
          copy: { INSUFFICIENT_QUANTITY: gone, NOT_FOUND: gone },
        }),
      inputs,
    );
    if (settled.status !== 'failed') return 'recorded';
    return NOTHING_LEFT.has(settled.failure?.code ?? '')
      ? 'nothingLeft'
      : 'failed';
  };

  return { finishStock };
}

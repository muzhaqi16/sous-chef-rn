import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#i18n';
import { errorService } from '#services/errorService';
import { alertService } from '#services/alertService';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { SettleStatus } from '#apollo/utils/settleMutation';
import { CreatePantryItemUsageDocument } from '#features/pantry/graphql/pantry.generated';
import { dropRankedUnits } from '#features/pantry/cache/rankedUnits';
import {
  TopLevelErrorCode,
  UsagePurpose,
  type CreatePantryItemUsageInput,
} from '#graphql/generated/schemaTypes';
import { generateEntityId } from '#utils/generateEntityId';
import { todayKey } from '#utils/dateUtils';
import { inTrackingUnit } from '#entities/pantryItem/stock';
import type { DrawStockInputs } from '#features/pantry/offline/localWrites';

/** The uses whose unit the server remembers: not waste, a transfer or a gift. */
const REMEMBERS_ITS_UNIT: ReadonlySet<UsagePurpose> = new Set([
  UsagePurpose.Cooking,
  UsagePurpose.Snack,
  UsagePurpose.MealPrep,
  UsagePurpose.General,
]);

export interface PantryUsage {
  pantryItemId: string;
  quantity: number;
  usageUnitId: string | undefined;
  usage: Pick<
    CreatePantryItemUsageInput,
    'purpose' | 'notes' | 'wasteReason' | 'isComposted' | 'isRecycled'
  >;
  /** Taken from this batch alone, never the stack's usual draw order. */
  batchId?: string;
  fallback: string;
}

/** A use or a waste of a stack, local-first: one usage write either way. */
export function useRecordPantryUsage() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const refetchRankedUnits = () => dropRankedUnits(client.cache);
  // Replays as the canonical mutation, deduped by its idempotencyKey.
  const createUsage = useLocalWrite(CreatePantryItemUsageDocument, {
    fallback: t('errors.recordUsageFailedRetry'),
    on: { [TopLevelErrorCode.UnitInvalid]: refetchRankedUnits },
  });

  const recordUsage = async ({
    pantryItemId,
    quantity,
    usageUnitId,
    usage,
    batchId,
    fallback,
  }: PantryUsage): Promise<SettleStatus> => {
    // A converted unit moves the stock when the server answers. Whichever
    // batch it comes from, the stack holds that much less.
    const used = inTrackingUnit(
      client.cache,
      pantryItemId,
      quantity,
      usageUnitId,
    );
    const inputs: DrawStockInputs = {
      delta: used === null ? null : -used,
      stated: usageUnitId ? { amount: quantity, unitId: usageUnitId } : null,
      usedUnitId: REMEMBERS_ITS_UNIT.has(usage.purpose) ? usageUnitId : null,
      now: new Date().toISOString(),
    };
    const today = todayKey();
    const input: CreatePantryItemUsageInput = {
      pantryItemId,
      amount: { quantity },
      usageUnitId,
      ...usage,
      ...(batchId ? { targetBatchId: batchId } : {}),
      today,
      // idempotencyKey dedups the usage ledger row on replay.
      idempotencyKey: generateEntityId(),
    };
    try {
      const settled = await createUsage.send({ today, input }, inputs, {
        settle: { fallback },
      });
      return settled.status;
    } catch (error) {
      errorService.reportError(error, { operation: 'Record pantry usage' });
      alertService.alert(t('labels.error'), fallback);
      return 'failed';
    }
  };

  return { recordUsage };
}

/**
 * Corrects what a package holds. A measure restates one batch's size: the same
 * fraction remains, so the remaining weight scales, and `input.idempotencyKey`
 * keeps a replay from writing the history twice. A count is what the stack is
 * used by: a new one defines it, and the one it has corrects the batch's.
 */

import { useApolloClient } from '@apollo/client/react';
import {
  UseCorrectPackageSize_BatchFragmentDoc,
  UseCorrectPackageSize_StackFragmentDoc,
  type UseCorrectPackageSize_BatchFragment,
  type UseCorrectPackageSize_StackFragment,
} from './useCorrectPackageSize.generated';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { localUnit } from '#entities/unit/localUnit';
import { UnitType } from '#graphql/generated/schemaTypes';
import { generateEntityId } from '#utils/generateEntityId';
import { errorService } from '#services/errorService';
import { useTranslation } from '#i18n';
import { todayKey } from '#utils/dateUtils';
import type { PackageSizeCorrectionInput } from '#features/pantry/types';
import {
  correctPantryItemPackageSizeWrite,
  updatePantryItemWrite,
} from '#features/pantry/offline/localWrites';

export interface PackageSizeCorrection extends PackageSizeCorrectionInput {
  pantryItemId: string;
  batchId: string;
}

function scaledRemaining(
  batch: UseCorrectPackageSize_BatchFragment,
  netWeight: number,
): number | null {
  if (batch.remainingNetWeight == null || !batch.netWeight) return null;
  return batch.remainingNetWeight * (netWeight / batch.netWeight);
}

export function useCorrectPackageSize() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const fallback = t('errors.correctWeightFailed');

  const correct = useLocalWrite(correctPantryItemPackageSizeWrite, {
    fallback,
    present: 'none',
  });
  const update = useLocalWrite(updatePantryItemWrite, {
    fallback,
    present: 'none',
  });

  /** Resolves null once it stands, else why it was refused, for its field. */
  const correctPackageSize = async ({
    pantryItemId,
    batchId,
    amount,
    unitId,
    unitType,
    reason,
  }: PackageSizeCorrection): Promise<string | null> => {
    const item = client.cache.readFragment<UseCorrectPackageSize_StackFragment>(
      {
        id: client.cache.identify({
          __typename: 'PantryItem',
          id: pantryItemId,
        }),
        fragment: UseCorrectPackageSize_StackFragmentDoc,
        fragmentName: 'useCorrectPackageSize_stack',
        optimistic: true,
      },
    );
    if (!item) {
      errorService.reportError(new Error('Pantry item not in cache'), {
        operation: 'Correct package size',
      });
      return fallback;
    }

    if (unitType === UnitType.Count && item.portionUnitId !== unitId) {
      const settled = await update.send(
        {
          today: todayKey(),
          input: {
            id: pantryItemId,
            version: item.version,
            measurementProfile: {
              portionUnitId: unitId,
              portionsPerTrackingUnit: amount,
            },
          },
        },
        {
          entity: { __typename: 'PantryItem', id: pantryItemId },
          fields: {
            portionUnitId: unitId,
            portionUnit: localUnit(client.cache, unitId, ''),
          },
        },
      );
      return settled.status === 'failed'
        ? settled.failure?.body ?? fallback
        : null;
    }

    const batch =
      client.cache.readFragment<UseCorrectPackageSize_BatchFragment>({
        id: client.cache.identify({
          __typename: 'PantryItemBatch',
          id: batchId,
        }),
        fragment: UseCorrectPackageSize_BatchFragmentDoc,
        fragmentName: 'useCorrectPackageSize_batch',
        optimistic: true,
      });

    // A batch's size is recorded in the stack's net-weight unit; a size stated
    // in another unit is converted by the server, so only its answer is shown.
    const sameUnit =
      unitType !== UnitType.Count && item.netWeightUnit?.id === unitId;
    const corrected =
      batch && sameUnit
        ? {
            netWeight: amount,
            remainingNetWeight: scaledRemaining(batch, amount),
          }
        : {};

    const settled = await correct.send(
      {
        today: todayKey(),
        input: {
          batchId,
          correction:
            unitType === UnitType.Count
              ? { portionsPerTrackingUnit: amount }
              : { packageSize: { netWeight: amount, netWeightUnitId: unitId } },
          reason,
          version: item.version,
          idempotencyKey: generateEntityId(),
        },
      },
      {
        entity: { __typename: 'PantryItemBatch', id: batchId },
        fields: corrected,
      },
    );
    return settled.status === 'failed'
      ? settled.failure?.body ?? fallback
      : null;
  };

  return { correctPackageSize };
}

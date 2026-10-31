/**
 * Corrects a misread batch package size; the same fraction remains, so the
 * remaining weight scales. `input.idempotencyKey` keeps a replay from writing
 * the history twice.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { CorrectPantryItemPackageSizeDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseCorrectPackageSize_BatchFragmentDoc,
  UseCorrectPackageSize_StackFragmentDoc,
  type UseCorrectPackageSize_BatchFragment,
  type UseCorrectPackageSize_StackFragment,
} from './useCorrectPackageSize.generated';
import { alertService } from '#/services/alertService';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';

export interface PackageSizeCorrection {
  pantryItemId: string;
  batchId: string;
  netWeight: number;
  netWeightUnitId: string;
  reason: string;
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

  const [correctMutation] = useMutation(CorrectPantryItemPackageSizeDocument, {
    context: { localFirst: true },
  });

  /** Resolves false on a refusal, which has been alerted. */
  const correctPackageSize = async ({
    pantryItemId,
    batchId,
    netWeight,
    netWeightUnitId,
    reason,
  }: PackageSizeCorrection): Promise<boolean> => {
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
      alertService.alert(t('labels.error'), t('errors.correctWeightFailed'));
      return false;
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
    const sameUnit = item.netWeightUnit?.id === netWeightUnitId;
    const corrected =
      batch && sameUnit
        ? { netWeight, remainingNetWeight: scaledRemaining(batch, netWeight) }
        : {};

    const settled = await sendFields(client.cache, {
      entity: { __typename: 'PantryItemBatch', id: batchId },
      fields: corrected,
      variables: {
        today: todayKey(),
        input: {
          batchId,
          correction: { packageSize: { netWeight, netWeightUnitId } },
          reason,
          version: item.version,
          idempotencyKey: generateEntityId(),
        },
      },
      mutate: correctMutation,
      settle: {
        document: CorrectPantryItemPackageSizeDocument,
        fallback: t('errors.correctWeightFailed'),
      },
    });
    if (settled.status === 'failed') return false;
    return true;
  };

  return { correctPackageSize };
}

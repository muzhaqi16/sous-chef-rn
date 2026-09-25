/**
 * Corrects one batch's package size when it was misread. The same fraction of
 * the package remains, so the batch's remaining weight scales with its size.
 * Local-first: the cache is written PERMANENTLY before firing, and
 * `input.idempotencyKey` keeps a queued replay from writing the history twice.
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
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

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

  const [correctMutation] = useMutation(CorrectPantryItemPackageSizeDocument);

  /** Resolves false on a refusal, which has been alerted and reverted. */
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
      },
    );
    if (!item) {
      errorService.reportError(new Error('Pantry item not in cache'), {
        operation: 'Correct package size',
      });
      alertService.alert(t('labels.error'), t('errors.correctWeightFailed'));
      return false;
    }

    const batchCacheId = client.cache.identify({
      __typename: 'PantryItemBatch',
      id: batchId,
    });
    const batch =
      client.cache.readFragment<UseCorrectPackageSize_BatchFragment>({
        id: batchCacheId,
        fragment: UseCorrectPackageSize_BatchFragmentDoc,
        fragmentName: 'useCorrectPackageSize_batch',
      });
    const writeBatch = (data: UseCorrectPackageSize_BatchFragment) =>
      client.cache.writeFragment({
        id: batchCacheId,
        fragment: UseCorrectPackageSize_BatchFragmentDoc,
        fragmentName: 'useCorrectPackageSize_batch',
        data,
      });

    // A batch's size is recorded in the stack's net-weight unit; a size stated
    // in another unit is converted by the server, so only its answer is shown.
    const sameUnit = item.netWeightUnit?.id === netWeightUnitId;
    const cleanups: Array<() => void> = [];
    if (batch && sameUnit) {
      const remainingNetWeight = scaledRemaining(batch, netWeight);
      try {
        writeBatch({ ...batch, netWeight, remainingNetWeight });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Correct package size (optimistic)',
        });
      }
      cleanups.push(
        optimisticDataPersistence.track(
          'PantryItemBatch',
          batchId,
          'netWeight',
          netWeight,
        ),
        optimisticDataPersistence.track(
          'PantryItemBatch',
          batchId,
          'remainingNetWeight',
          remainingNetWeight,
        ),
      );
    }
    const clearPersisted = () => {
      cleanups.forEach(cleanup => cleanup());
    };

    const revert = () => {
      if (batch && sameUnit) {
        try {
          writeBatch(batch);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert refused package size correction',
          });
        }
      }
      clearPersisted();
    };

    const settled = await settleMutation(
      () =>
        correctMutation({
          variables: {
            input: {
              batchId,
              correction: { packageSize: { netWeight, netWeightUnitId } },
              reason,
              version: item.version,
              idempotencyKey: generateEntityId(),
            },
          },
          context: { localFirst: true },
        }),
      {
        document: CorrectPantryItemPackageSizeDocument,
        fallback: t('errors.correctWeightFailed'),
        onFailed: revert,
      },
    );
    if (settled.status === 'failed') return false;

    // Applied: the response normalized the server's figures. Queued: the
    // persisted ones stand until the replay lands.
    if (settled.status === 'applied') clearPersisted();
    return true;
  };

  return { correctPackageSize };
}

/**
 * Corrects net weight after use, writing a WEIGHT_CORRECTED audit record.
 * Local-first: the cache is written PERMANENTLY before firing (an
 * `optimisticResponse` rolls back on the queue's null result), and
 * `input.idempotencyKey` keeps a queued replay from writing the audit twice.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { AdjustPantryItemWeightDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseCorrectPantryItemWeight_PantryItemFragmentDoc,
  type UseCorrectPantryItemWeight_PantryItemFragment,
} from './useCorrectPantryItemWeight.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

interface UseCorrectPantryItemWeightOptions {
  onSuccess?: () => void;
}

export function useCorrectPantryItemWeight({
  onSuccess,
}: UseCorrectPantryItemWeightOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [correctMutation] = useMutation(AdjustPantryItemWeightDocument);

  const correctWeight = async (
    pantryItemId: string,
    netWeight: number,
    reason: string,
    version: number,
    netWeightUnitId?: string,
  ): Promise<boolean> => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: pantryItemId,
    });
    const currentItem =
      client.cache.readFragment<UseCorrectPantryItemWeight_PantryItemFragment>({
        id: cacheId,
        fragment: UseCorrectPantryItemWeight_PantryItemFragmentDoc,
        fragmentName: 'useCorrectPantryItemWeight_pantryItem',
      });

    const writeItem = (data: UseCorrectPantryItemWeight_PantryItemFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseCorrectPantryItemWeight_PantryItemFragmentDoc,
        fragmentName: 'useCorrectPantryItemWeight_pantryItem',
        data,
      });

    // The correction is absolute (a physical re-weigh), so set it directly and
    // persist it across an app-kill. The unit is NOT changed locally: an id
    // alone would write a half-populated Unit; the server's response fills it.
    if (currentItem) {
      const optimistic = enhanceWithVersion(currentItem, { netWeight });
      try {
        writeItem(optimistic);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Correct Pantry Item Weight (optimistic)',
        });
      }
      optimisticDataPersistence.save(
        'PantryItem',
        pantryItemId,
        'netWeight',
        netWeight,
      );
    }

    const revert = () => {
      if (currentItem) {
        try {
          writeItem(currentItem);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected pantry weight correction',
          });
        }
      }
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'netWeight');
    };

    const settled = await settleMutation(
      () =>
        correctMutation({
          variables: {
            input: {
              id: pantryItemId,
              netWeight,
              reason,
              version,
              idempotencyKey: generateEntityId(),
              ...(netWeightUnitId ? { netWeightUnitId } : {}),
            },
          },
          context: { localFirst: true },
        }),
      {
        document: AdjustPantryItemWeightDocument,
        fallback: t('errors.correctWeightFailed'),
        onFailed: revert,
      },
    );
    if (settled.status === 'failed') return false;

    // Applied: the response normalized the authoritative value. Queued: the
    // persisted value stands until the replay lands.
    if (settled.status === 'applied') {
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'netWeight');
    }
    onSuccess?.();
    return true;
  };

  return { correctWeight };
}

/**
 * Local-first: the corrected count is written to the cache PERMANENTLY before
 * firing — an `optimisticResponse` rolls back on the offline queue's null
 * result. The server writes an ADJUSTMENT ledger row per adjust, so
 * `input.idempotencyKey` is what keeps a queued replay from double-counting.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { AdjustPantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
  type UseAdjustPantryItemQuantity_PantryItemFragment,
} from './useAdjustPantryItemQuantity.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

interface UseAdjustPantryItemQuantityOptions {
  onSuccess?: () => void;
}

export function useAdjustPantryItemQuantity({
  onSuccess,
}: UseAdjustPantryItemQuantityOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [adjustMutation] = useMutation(AdjustPantryItemQuantityDocument);

  const adjustQuantity = async (
    pantryItemId: string,
    newQuantity: number,
    reason: string,
    version: number,
    remainingNetWeight?: number,
  ): Promise<boolean> => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: pantryItemId,
    });
    const currentItem =
      client.cache.readFragment<UseAdjustPantryItemQuantity_PantryItemFragment>(
        {
          id: cacheId,
          fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
        },
      );

    const writeItem = (data: UseAdjustPantryItemQuantity_PantryItemFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
        fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
        data,
      });

    // Permanent optimistic write before firing — newQuantity is absolute (a
    // physical recount), so set it directly. Persist it too so the exact value
    // survives an app-kill before the queue replays.
    if (currentItem) {
      const optimistic = enhanceWithVersion(currentItem, {
        quantity: newQuantity,
        ...(remainingNetWeight != null ? { remainingNetWeight } : {}),
      });
      try {
        writeItem(optimistic);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Adjust Pantry Item Quantity (optimistic)',
        });
      }
      optimisticDataPersistence.save(
        'PantryItem',
        pantryItemId,
        'quantity',
        newQuantity,
      );
    }

    const revert = () => {
      if (currentItem) {
        try {
          writeItem(currentItem);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected pantry quantity adjust',
          });
        }
      }
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'quantity');
    };

    // idempotencyKey dedups the ADJUSTMENT ledger entry on replay. `version` is
    // the optimistic-concurrency check the server requires.
    const settled = await settleMutation(
      () =>
        adjustMutation({
          variables: {
            input: {
              id: pantryItemId,
              newQuantity,
              reason,
              idempotencyKey: generateEntityId(),
              version,
              ...(remainingNetWeight != null ? { remainingNetWeight } : {}),
            },
          },
          context: { localFirst: true },
        }),
      {
        document: AdjustPantryItemQuantityDocument,
        fallback: t('errors.adjustQuantityFailed'),
        onFailed: revert,
      },
    );
    if (settled.status === 'failed') return false;

    // Applied: the response normalized the authoritative value. Queued: the
    // persisted value stands until the replay lands.
    if (settled.status === 'applied') {
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'quantity');
    }
    onSuccess?.();
    return true;
  };

  return { adjustQuantity };
}

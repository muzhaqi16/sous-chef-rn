/**
 * Wastes a stack's expired stock as one WASTE usage record. A stack with no
 * batches is wasted whole: `condition` SPOILED + `quantity` 0, written to the
 * cache PERMANENTLY before firing (an `optimisticResponse` rolls back on the
 * queue's null result). A stack held in batches loses only the expired ones,
 * which the server recomputes, so nothing is written ahead of its answer.
 * `input.idempotencyKey` keeps a queued replay from double-counting the ledger.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  ConvertExpiredToWasteDocument,
  GetPantryItemBatchesDocument,
} from '#features/pantry/graphql/pantry.generated';
import { UseConvertExpiredToWaste_StateFragmentDoc } from './useConvertExpiredToWaste.generated';
import { ItemCondition } from '#/graphql/generated/schemaTypes';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useTranslation } from '#/i18n';
import { errorService } from '#/services/errorService';
import { writeHeldStock } from '#features/pantry/cache/stock';
import { todayKey } from '#/utils/dateUtils';

interface UseConvertExpiredToWasteOptions {
  onSuccess?: (wasted: { hasBatches: boolean }) => void;
}

export function useConvertExpiredToWaste({
  onSuccess,
}: UseConvertExpiredToWasteOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [convertMutation] = useMutation(ConvertExpiredToWasteDocument, {
    context: { localFirst: true },
  });

  const convertExpiredToWaste = async (
    pantryItemId: string,
    { hasBatches }: { hasBatches: boolean },
  ): Promise<boolean> => {
    // Captured at the tap, so a replay judges the day the user saw.
    const today = todayKey();
    const variables = {
      today,
      input: { pantryItemId, idempotencyKey: generateEntityId(), today },
    };
    if (hasBatches) {
      const settledBatches = await settleMutation(
        () => convertMutation({ variables }),
        {
          document: ConvertExpiredToWasteDocument,
          fallback: t('errors.discardExpiredFailed'),
        },
      );
      if (settledBatches.status === 'failed') return false;
      // The answer restates the stack, not its batches: read them again so the
      // wasted batch leaves the list. A queued waste is re-read after the drain.
      if (settledBatches.status === 'applied') {
        void client.refetchQueries({ include: [GetPantryItemBatchesDocument] });
      }
      onSuccess?.({ hasBatches });
      return true;
    }

    const itemCacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: pantryItemId,
    });
    const snapshot = client.cache.readFragment({
      id: itemCacheId,
      fragment: UseConvertExpiredToWaste_StateFragmentDoc,
      fragmentName: 'useConvertExpiredToWaste_state',
    });

    const writeState = (
      quantity: number,
      heldQuantity: number,
      condition: ItemCondition,
    ) => {
      client.cache.modify({
        id: itemCacheId,
        fields: {
          quantity: () => quantity,
          condition: () => condition,
        },
      });
      writeHeldStock(client.cache, pantryItemId, heldQuantity);
    };

    // Permanent optimistic write before firing — survives an offline/queued convert.
    const clearPersistence = optimisticDataPersistence.trackFields(
      'PantryItem',
      pantryItemId,
      { quantity: 0, heldQuantity: 0, condition: ItemCondition.Spoiled },
    );
    try {
      writeState(0, 0, ItemCondition.Spoiled);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Convert Expired To Waste (optimistic)',
      });
    }

    const revert = () => {
      // Only from a real snapshot — falling back to 0/SPOILED would re-apply
      // the optimistic write instead of restoring the item.
      if (snapshot) {
        try {
          writeState(
            snapshot.quantity,
            snapshot.heldQuantity,
            snapshot.condition,
          );
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected expired-to-waste convert',
          });
        }
      }
      clearPersistence();
    };

    const settled = await settleMutation(() => convertMutation({ variables }), {
      document: ConvertExpiredToWasteDocument,
      fallback: t('errors.discardExpiredFailed'),
      onFailed: revert,
    });
    if (settled.status === 'failed') return false;

    // Applied: the response normalized the authoritative item. Queued: the
    // persisted values stand until the replay lands.
    if (settled.status === 'applied') {
      clearPersistence();
    }
    onSuccess?.({ hasBatches });
    return true;
  };

  return { convertExpiredToWaste };
}

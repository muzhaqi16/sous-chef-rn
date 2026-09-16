/**
 * Sets `condition` SPOILED + `quantity` 0 and writes a WASTE usage record.
 * Local-first: the cache is written PERMANENTLY before firing (an
 * `optimisticResponse` rolls back on the queue's null result), and
 * `input.idempotencyKey` keeps a queued replay from double-counting the ledger.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { ConvertExpiredToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { ItemCondition } from '#/graphql/generated/schemaTypes';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useTranslation } from '#/i18n';
import { errorService } from '#/services/errorService';

interface UseConvertExpiredToWasteOptions {
  onSuccess?: () => void;
}

const CONVERT_STATE_FRAGMENT = gql`
  fragment useConvertExpiredToWaste_state on PantryItem {
    id
    quantity
    condition
  }
`;

export function useConvertExpiredToWaste({
  onSuccess,
}: UseConvertExpiredToWasteOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [convertMutation] = useMutation(ConvertExpiredToWasteDocument);

  const convertExpiredToWaste = async (
    pantryItemId: string,
  ): Promise<boolean> => {
    const itemCacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: pantryItemId,
    });
    const snapshot = client.cache.readFragment<{
      quantity: number;
      condition: ItemCondition;
    }>({
      id: itemCacheId,
      fragment: CONVERT_STATE_FRAGMENT,
      fragmentName: 'useConvertExpiredToWaste_state',
    });

    const writeState = (quantity: number, condition: ItemCondition) =>
      client.cache.modify({
        id: itemCacheId,
        fields: { quantity: () => quantity, condition: () => condition },
      });

    // Permanent optimistic write before firing — survives an offline/queued convert.
    const clearQuantityPersistence = optimisticDataPersistence.track(
      'PantryItem',
      pantryItemId,
      'quantity',
      0,
    );
    const clearConditionPersistence = optimisticDataPersistence.track(
      'PantryItem',
      pantryItemId,
      'condition',
      ItemCondition.Spoiled,
    );
    const clearPersistence = () => {
      clearQuantityPersistence();
      clearConditionPersistence();
    };
    try {
      writeState(0, ItemCondition.Spoiled);
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
          writeState(snapshot.quantity, snapshot.condition);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected expired-to-waste convert',
          });
        }
      }
      clearPersistence();
    };

    const settled = await settleMutation(
      () =>
        convertMutation({
          variables: {
            input: { pantryItemId, idempotencyKey: generateEntityId() },
          },
          context: { localFirst: true },
        }),
      {
        document: ConvertExpiredToWasteDocument,
        fallback: t('errors.discardExpiredFailed'),
        onFailed: revert,
      },
    );
    if (settled.status === 'failed') return false;

    // Applied: the response normalized the authoritative item. Queued: the
    // persisted values stand until the replay lands.
    if (settled.status === 'applied') {
      clearPersistence();
    }
    onSuccess?.();
    return true;
  };

  return { convertExpiredToWaste };
}

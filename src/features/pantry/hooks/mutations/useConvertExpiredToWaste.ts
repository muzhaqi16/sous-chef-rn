/**
 * useConvertExpiredToWaste - Mutation hook for discarding an expired pantry item
 * (local-first).
 *
 * Converts an expired pantry item to waste in one step: sets `condition` to
 * SPOILED, creates a WASTE usage record with wasteReason=EXPIRED, and sets
 * `quantity` to 0. The cached item is set to quantity 0 + SPOILED PERMANENTLY
 * before firing so it reads as discarded instantly and survives an
 * offline/queued conversion. Because the server writes a waste ledger row, the
 * original mutation isn't replay-safe — the queue replays it through
 * `syncConvertExpiredToWaste` keyed by a client-minted `operationId`, so a replay
 * applies the conversion exactly once. A real rejection restores the pre-convert
 * quantity + condition.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { ConvertExpiredToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { ItemCondition } from '#/graphql/generated/schemaTypes';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { handleMutationError } from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import { t } from '#/i18n/t';

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
  const client = useApolloClient();
  const [convertMutation, { loading }] = useMutation(
    ConvertExpiredToWasteDocument,
    {
      onError: error => {
        handleMutationError(error, { operation: 'Convert Expired To Waste' });
      },
    },
  );

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
    executeCacheUpdate(
      () => writeState(0, ItemCondition.Spoiled),
      'Convert Expired To Waste (optimistic)',
    );

    const operationId = generateEntityId();
    const result = await convertMutation({
      variables: { input: { pantryItemId } },
      context: { localFirst: true, operationId },
    });

    const outcome = classifyCreateResult(
      result,
      'convertExpiredToWaste',
      'ConvertExpiredToWastePayload',
    );

    if (outcome === 'rejected') {
      executeCacheUpdate(
        () =>
          writeState(
            snapshot?.quantity ?? 0,
            snapshot?.condition ?? ItemCondition.Spoiled,
          ),
        'Revert rejected expired-to-waste convert',
      );
      clearPersistence();
      // onError covers transport errors; a non-success union payload has none.
      alertRejectedMutation(result, t('errors.removeItemFailed'));
      return false;
    }

    // created (response normalized the authoritative item) or queued
    // (replays via syncConvertExpiredToWaste).
    if (outcome === 'created') {
      clearPersistence();
    }
    onSuccess?.();
    return true;
  };

  return { convertExpiredToWaste, loading };
}

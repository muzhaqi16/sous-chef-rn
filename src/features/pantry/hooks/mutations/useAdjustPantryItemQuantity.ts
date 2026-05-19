/**
 * useAdjustPantryItemQuantity - Mutation hook for adjusting pantry item quantity
 *
 * Adjusts pantry item quantity to match a physical count.
 * Creates an ADJUSTMENT usage record with mandatory reason for audit trail.
 */

import { useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { AdjustPantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import {
  isInvalidUnitError,
  getInvalidUnitMessage,
} from '#/utils/errors/invalidUnit';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

interface UseAdjustPantryItemQuantityOptions {
  onSuccess?: () => void;
}

export function useAdjustPantryItemQuantity({
  onSuccess,
}: UseAdjustPantryItemQuantityOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [adjustMutation, { loading }] = useMutation(
    AdjustPantryItemQuantityDocument,
    {},
  );

  const adjustQuantity = async (
    pantryItemId: string,
    newQuantity: number,
    reason: string,
    version?: number,
    remainingNetWeight?: number,
  ): Promise<boolean> => {
    const result = await adjustMutation({
      variables: {
        id: pantryItemId,
        input: {
          newQuantity,
          reason,
          ...(version != null ? { version } : {}),
          ...(remainingNetWeight != null ? { remainingNetWeight } : {}),
        },
      },
      update: (_cache, { data: mutationData }) => {
        const pantryItem = mutationData?.adjustPantryItemQuantity?.pantryItem;
        if (!pantryItem) return;

        // Apollo auto-normalizes the mutation response into the cached
        // PantryItem entity via __typename + id; no explicit writeFragment
        // is needed here. We do persist the optimistic quantity so it
        // survives cache-and-network refetches while offline.
        optimisticDataPersistence.save(
          'PantryItem',
          pantryItemId,
          'quantity',
          newQuantity,
        );
      },
    });

    if (result.data?.adjustPantryItemQuantity?.pantryItem) {
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'quantity');
      onSuccess?.();
      return true;
    }

    if (result.error) {
      if (handleVersionConflict(result.error)) {
        alertService.alert(
          'Item Updated',
          getVersionConflictMessage(result.error),
        );
      } else if (isInvalidUnitError(result.error)) {
        alertService.alert('Invalid Unit', getInvalidUnitMessage(result.error));
      } else {
        const { message } = handleApolloError(result.error, {
          operation: 'Adjust Quantity',
        });
        alertService.alert('Error', message);
      }
    }

    return false;
  };

  return { adjustQuantity, loading };
}

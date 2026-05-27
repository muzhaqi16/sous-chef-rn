/**
 * useAdjustPantryItemQuantity - Mutation hook for adjusting pantry item quantity
 *
 * Adjusts pantry item quantity to match a physical count.
 * Creates an ADJUSTMENT usage record with mandatory reason for audit trail.
 */

import { useMutation } from '@apollo/client/react';
import { AdjustPantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import {
  handleMutationError,
  versionConflictCheck,
  invalidUnitCheck,
} from '#/utils/errorHandlers';
import { isSuccessPayload } from '#/utils/compilerSafeWrappers';

interface UseAdjustPantryItemQuantityOptions {
  onSuccess?: () => void;
}

export function useAdjustPantryItemQuantity({
  onSuccess,
}: UseAdjustPantryItemQuantityOptions = {}) {
  const [adjustMutation, { loading }] = useMutation(
    AdjustPantryItemQuantityDocument,
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
        input: {
          id: pantryItemId,
          newQuantity,
          reason,
          ...(version != null ? { version } : {}),
          ...(remainingNetWeight != null ? { remainingNetWeight } : {}),
        },
      },
      update: (_cache, { data: mutationData }) => {
        const payload = mutationData?.adjustPantryItemQuantity;
        if (payload?.__typename !== 'AdjustPantryItemQuantityPayload') return;

        optimisticDataPersistence.save(
          'PantryItem',
          pantryItemId,
          'quantity',
          newQuantity,
        );
      },
    });

    if (
      isSuccessPayload(
        result.data?.adjustPantryItemQuantity,
        'AdjustPantryItemQuantityPayload',
      )
    ) {
      optimisticDataPersistence.clear('PantryItem', pantryItemId, 'quantity');
      onSuccess?.();
      return true;
    }

    if (result.error) {
      handleMutationError(result.error, {
        operation: 'Adjust Quantity',
        checks: [versionConflictCheck(), invalidUnitCheck()],
      });
    }

    return false;
  };

  return { adjustQuantity, loading };
}

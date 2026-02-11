/**
 * useAdjustPantryItemQuantity - Mutation hook for adjusting pantry item quantity
 *
 * Adjusts pantry item quantity to match a physical count.
 * Creates an ADJUSTMENT usage record with mandatory reason for audit trail.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAdjustPantryItemQuantityMutation } from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';

interface UseAdjustPantryItemQuantityOptions {
  onSuccess?: () => void;
}

export function useAdjustPantryItemQuantity({
  onSuccess,
}: UseAdjustPantryItemQuantityOptions = {}) {
  const { handleApolloError } = useErrorHandler();

  const [adjustMutation, { loading }] = useAdjustPantryItemQuantityMutation({
    errorPolicy: 'all',
  });

  const adjustQuantity = useCallback(
    async (
      pantryItemId: string,
      newQuantity: number,
      reason: string,
    ): Promise<boolean> => {
      const result = await adjustMutation({
        variables: {
          id: pantryItemId,
          input: { newQuantity, reason },
        },
        update: (cache, { data: mutationData }) => {
          if (!mutationData?.adjustPantryItemQuantity) return;

          const updatedItem = mutationData.adjustPantryItemQuantity;

          cache.modify({
            id: cache.identify({ __typename: 'PantryItem', id: updatedItem.id }),
            fields: {
              quantity: () => updatedItem.quantity,
              version: () => updatedItem.version,
            },
          });
        },
      });

      if (result.data?.adjustPantryItemQuantity) {
        onSuccess?.();
        return true;
      }

      if (result.error) {
        const { message } = handleApolloError(result.error, {
          operation: 'Adjust Quantity',
        });
        Alert.alert('Error', message);
      }

      return false;
    },
    [adjustMutation, onSuccess, handleApolloError],
  );

  return { adjustQuantity, loading };
}

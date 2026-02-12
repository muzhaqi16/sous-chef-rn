/**
 * useAdjustPantryItemQuantity - Mutation hook for adjusting pantry item quantity
 *
 * Adjusts pantry item quantity to match a physical count.
 * Creates an ADJUSTMENT usage record with mandatory reason for audit trail.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useAdjustPantryItemQuantityMutation,
  PantryItemFragmentDoc,
} from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';

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
        update: (cache, { data: mutationData }) => {
          const pantryItem = mutationData?.adjustPantryItemQuantity?.pantryItem;
          if (!pantryItem) return;

          cache.writeFragment({
            id: cache.identify({
              __typename: 'PantryItem',
              id: pantryItem.id,
            }),
            fragment: PantryItemFragmentDoc,
            fragmentName: 'PantryItemFragment',
            data: pantryItem,
          });
        },
      });

      if (result.data?.adjustPantryItemQuantity?.pantryItem) {
        onSuccess?.();
        return true;
      }

      if (result.error) {
        if (handleVersionConflict(result.error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(result.error));
        } else {
          const { message } = handleApolloError(result.error, {
            operation: 'Adjust Quantity',
          });
          Alert.alert('Error', message);
        }
      }

      return false;
    },
    [adjustMutation, onSuccess, handleApolloError],
  );

  return { adjustQuantity, loading };
}

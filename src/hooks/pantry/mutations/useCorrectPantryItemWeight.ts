/**
 * useCorrectPantryItemWeight - Mutation hook for correcting pantry item net weight
 *
 * Used after an item has been used (lastUsedAt is set).
 * Creates a WEIGHT_CORRECTED audit record with mandatory reason.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useCorrectPantryItemWeightMutation,
  PantryItemDisplayFragmentDoc,
} from '#generated';
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';

interface UseCorrectPantryItemWeightOptions {
  onSuccess?: () => void;
}

export function useCorrectPantryItemWeight({
  onSuccess,
}: UseCorrectPantryItemWeightOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [correctMutation, { loading }] = useCorrectPantryItemWeightMutation({
    errorPolicy: 'all',
    update: (cache, { data }) => {
      const pantryItem = data?.correctPantryItemWeight?.pantryItem;
      if (!pantryItem) return;

      cache.writeFragment({
        id: cache.identify({
          __typename: 'PantryItem',
          id: pantryItem.id,
        }),
        fragment: PantryItemDisplayFragmentDoc,
        fragmentName: 'PantryItemDisplay',
        data: pantryItem,
      });
    },
  });

  const correctWeight = useCallback(
    async (
      pantryItemId: string,
      netWeight: number,
      reason: string,
      version: number,
      netWeightUnitId?: string,
    ): Promise<boolean> => {
      const result = await correctMutation({
        variables: {
          id: pantryItemId,
          input: {
            netWeight,
            reason,
            version,
            ...(netWeightUnitId ? { netWeightUnitId } : {}),
          },
        },
      });

      if (result.data?.correctPantryItemWeight?.pantryItem) {
        onSuccess?.();
        return true;
      }

      if (result.error) {
        if (handleVersionConflict(result.error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(result.error));
        } else {
          const { message } = handleApolloError(result.error, {
            operation: 'Correct Weight',
          });
          Alert.alert('Error', message);
        }
      }

      return false;
    },
    [correctMutation, onSuccess, handleApolloError],
  );

  return { correctWeight, loading };
}

/**
 * useConvertExpiredToWaste - Mutation hook for discarding expired pantry items
 *
 * Converts an expired pantry item to waste in one step:
 * - Sets condition to SPOILED
 * - Creates a WASTE usage record with wasteReason=EXPIRED
 * - Sets quantity to 0
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useConvertExpiredToWasteMutation } from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';

interface UseConvertExpiredToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredToWaste({
  onSuccess,
}: UseConvertExpiredToWasteOptions = {}) {
  const { handleApolloError } = useErrorHandler();

  const [convertMutation, { loading }] = useConvertExpiredToWasteMutation({
    errorPolicy: 'all',
  });

  const convertExpiredToWaste = useCallback(
    async (pantryItemId: string): Promise<boolean> => {
      const result = await convertMutation({
        variables: { pantryItemId },
        update: (cache, { data: mutationData }) => {
          if (!mutationData?.convertExpiredToWaste) return;

          const updatedItem = mutationData.convertExpiredToWaste;

          // Update the pantry item in cache
          cache.modify({
            id: cache.identify({ __typename: 'PantryItem', id: updatedItem.id }),
            fields: {
              quantity: () => updatedItem.quantity,
              condition: () => updatedItem.condition,
            },
          });
        },
      });

      if (result.data?.convertExpiredToWaste) {
        onSuccess?.();
        return true;
      }

      if (result.error) {
        const { message } = handleApolloError(result.error, {
          operation: 'Discard Expired Item',
        });
        Alert.alert('Error', message);
      }

      return false;
    },
    [convertMutation, onSuccess, handleApolloError],
  );

  return { convertExpiredToWaste, loading };
}

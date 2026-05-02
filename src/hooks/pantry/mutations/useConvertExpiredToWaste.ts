/**
 * useConvertExpiredToWaste - Mutation hook for discarding expired pantry items
 *
 * Converts an expired pantry item to waste in one step:
 * - Sets condition to SPOILED
 * - Creates a WASTE usage record with wasteReason=EXPIRED
 * - Sets quantity to 0
 */

import { useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { ConvertExpiredToWasteDocument } from '#operations/pantry/pantry.generated';
import { useErrorService } from '#/services/errorService';

interface UseConvertExpiredToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredToWaste({
  onSuccess,
}: UseConvertExpiredToWasteOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [convertMutation, { loading }] = useMutation(
    ConvertExpiredToWasteDocument,
    { errorPolicy: 'all' },
  );

  const convertExpiredToWaste = async (
    pantryItemId: string,
  ): Promise<boolean> => {
    const result = await convertMutation({
      variables: { pantryItemId },
      update: (cache, { data: mutationData }) => {
        const updatedItem = mutationData?.convertExpiredToWaste?.pantryItem;
        if (!updatedItem) return;

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

    if (result.data?.convertExpiredToWaste?.pantryItem) {
      onSuccess?.();
      return true;
    }

    if (result.error) {
      const { message } = handleApolloError(result.error, {
        operation: 'Discard Expired Item',
      });
      alertService.alert('Error', message);
    }

    return false;
  };

  return { convertExpiredToWaste, loading };
}

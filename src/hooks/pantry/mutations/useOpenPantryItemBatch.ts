/**
 * useOpenPantryItemBatch - Mutation hook for marking a batch as opened
 */

import { Alert } from 'react-native';
import { useOpenPantryItemBatchMutation } from '#generated';
import { useErrorService } from '#/services/errorService';

interface UseOpenPantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useOpenPantryItemBatch({
  onSuccess,
}: UseOpenPantryItemBatchOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [openMutation, { loading }] = useOpenPantryItemBatchMutation({
    errorPolicy: 'all',
  });

  const openBatch = async (batchId: string): Promise<boolean> => {
    const now = new Date().toISOString();

    const result = await openMutation({
      variables: { input: { batchId } },
      optimisticResponse: undefined,
      update: (cache) => {
        // Optimistically update the batch in cache
        cache.modify({
          id: cache.identify({ __typename: 'PantryItemBatch', id: batchId }),
          fields: {
            isOpened: () => true,
            openedAt: () => now,
          },
        });
      },
    });

    if (result.data?.openPantryItemBatch?.pantryItem) {
      onSuccess?.();
      return true;
    }

    if (result.error) {
      const { message } = handleApolloError(result.error, {
        operation: 'Open Batch',
      });
      Alert.alert('Error', message);
    }

    return false;
  };

  return { openBatch, loading };
}

/**
 * useWastePantryItemBatch - Mutation hook for wasting a specific batch
 */

import { Alert } from 'react-native';
import {
  useWastePantryItemBatchMutation,
  type WasteReason,
} from '#generated';
import { useErrorService } from '#/services/errorService';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

interface UseWastePantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useWastePantryItemBatch({
  onSuccess,
}: UseWastePantryItemBatchOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [wasteMutation, { loading }] = useWastePantryItemBatchMutation({
    errorPolicy: 'all',
  });

  const wasteBatch = async (
    batchId: string,
    wasteReason?: WasteReason,
    isComposted?: boolean,
    isRecycled?: boolean,
    notes?: string,
  ): Promise<boolean> => {
    // Persist optimistic waste state to survive cache-and-network refetches while offline
    optimisticDataPersistence.save('PantryItemBatch', batchId, 'isWasted', true);

    const result = await wasteMutation({
      variables: {
        input: {
          batchId,
          wasteReason,
          isComposted,
          isRecycled,
          notes,
        },
      },
    });

    if (result.data?.wastePantryItemBatch?.pantryItem) {
      optimisticDataPersistence.clear('PantryItemBatch', batchId, 'isWasted');
      onSuccess?.();
      return true;
    }

    if (result.error) {
      const { message } = handleApolloError(result.error, {
        operation: 'Waste Batch',
      });
      Alert.alert('Error', message);
    }

    return false;
  };

  return { wasteBatch, loading };
}

/**
 * useWastePantryItemBatch - Mutation hook for wasting a specific batch
 */

import { Alert } from 'react-native';
import {
  useWastePantryItemBatchMutation,
  type WasteReason,
} from '#generated';
import { useErrorService } from '#/services/errorService';

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

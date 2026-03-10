/**
 * useConvertExpiredBatchesToWaste - Mutation hook for discarding all expired batches
 *
 * Converts all expired batches within a pantry item to waste.
 * No optimistic update — relies on server response for complex recalculation.
 */

import { Alert } from 'react-native';
import { useConvertExpiredBatchesToWasteMutation } from '#generated';
import { useErrorService } from '#/services/errorService';

interface UseConvertExpiredBatchesToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredBatchesToWaste({
  onSuccess,
}: UseConvertExpiredBatchesToWasteOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [convertMutation, { loading }] =
    useConvertExpiredBatchesToWasteMutation({
      errorPolicy: 'all',
    });

  const convertExpiredBatches = async (
    pantryItemId: string,
  ): Promise<boolean> => {
    const result = await convertMutation({
      variables: { pantryItemId },
    });

    if (result.data?.convertExpiredBatchesToWaste?.pantryItem) {
      onSuccess?.();
      return true;
    }

    if (result.error) {
      const { message } = handleApolloError(result.error, {
        operation: 'Discard Expired Batches',
      });
      Alert.alert('Error', message);
    }

    return false;
  };

  return { convertExpiredBatches, loading };
}

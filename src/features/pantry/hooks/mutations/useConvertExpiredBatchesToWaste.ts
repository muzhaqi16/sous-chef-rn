/**
 * useConvertExpiredBatchesToWaste - Mutation hook for discarding all expired batches
 *
 * Converts all expired batches within a pantry item to waste.
 * No optimistic update — relies on server response for complex recalculation.
 */

import { useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { ConvertExpiredBatchesToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { useErrorService } from '#/services/errorService';

interface UseConvertExpiredBatchesToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredBatchesToWaste({
  onSuccess,
}: UseConvertExpiredBatchesToWasteOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [convertMutation, { loading }] = useMutation(
    ConvertExpiredBatchesToWasteDocument,
    { errorPolicy: 'all' },
  );

  const convertExpiredBatches = async (
    pantryItemId: string,
  ): Promise<boolean> => {
    const result = await convertMutation({
      variables: { input: { pantryItemId } },
    });

    if (
      result.data?.convertExpiredBatchesToWaste?.__typename ===
      'ConvertExpiredBatchesToWastePayload'
    ) {
      onSuccess?.();
      return true;
    }

    if (result.error) {
      const { message } = handleApolloError(result.error, {
        operation: 'Discard Expired Batches',
      });
      alertService.alert('Error', message);
    }

    return false;
  };

  return { convertExpiredBatches, loading };
}

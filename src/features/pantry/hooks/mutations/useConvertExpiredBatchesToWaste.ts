/**
 * useConvertExpiredBatchesToWaste - Mutation hook for discarding all expired batches
 *
 * Converts all expired batches within a pantry item to waste.
 * No optimistic update — relies on server response for complex recalculation.
 */

import { useMutation } from '@apollo/client/react';
import { ConvertExpiredBatchesToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { unwrapPayload } from '#/utils/compilerSafeWrappers';

interface UseConvertExpiredBatchesToWasteOptions {
  onSuccess?: () => void;
}

export function useConvertExpiredBatchesToWaste({
  onSuccess,
}: UseConvertExpiredBatchesToWasteOptions = {}) {
  const [convertMutation, { loading }] = useMutation(
    ConvertExpiredBatchesToWasteDocument,
  );

  const convertExpiredBatches = async (pantryItemId: string) => {
    const { data } = await convertMutation({
      variables: { input: { pantryItemId } },
    });

    const result = unwrapPayload(
      data?.convertExpiredBatchesToWaste,
      'ConvertExpiredBatchesToWastePayload',
      'Failed to discard expired batches',
    );
    onSuccess?.();
    return result;
  };

  return { convertExpiredBatches, loading };
}

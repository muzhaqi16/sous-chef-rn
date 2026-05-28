/**
 * useOpenPantryItemBatch - Mutation hook for marking a batch as opened
 */

import { useMutation } from '@apollo/client/react';
import { OpenPantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { handleMutationError } from '#/utils/errorHandlers';
import { isSuccessPayload } from '#/utils/compilerSafeWrappers';

interface UseOpenPantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useOpenPantryItemBatch({
  onSuccess,
}: UseOpenPantryItemBatchOptions = {}) {
  const [openMutation, { loading }] = useMutation(OpenPantryItemBatchDocument);

  const openBatch = async (batchId: string): Promise<boolean> => {
    const now = new Date().toISOString();
    const clearPersistence = optimisticDataPersistence.track(
      'PantryItemBatch',
      batchId,
      'isOpened',
      true,
    );

    const result = await openMutation({
      variables: { input: { batchId } },
      update: cache => {
        cache.modify({
          id: cache.identify({ __typename: 'PantryItemBatch', id: batchId }),
          fields: {
            isOpened: () => true,
            openedAt: () => now,
          },
        });
      },
    });

    if (
      isSuccessPayload(
        result.data?.openPantryItemBatch,
        'OpenPantryItemBatchPayload',
      )
    ) {
      clearPersistence();
      onSuccess?.();
      return true;
    }

    if (result.error) {
      handleMutationError(result.error, { operation: 'Open Batch' });
    }

    return false;
  };

  return { openBatch, loading };
}

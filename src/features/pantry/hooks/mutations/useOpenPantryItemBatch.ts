/**
 * useOpenPantryItemBatch - Mutation hook for marking a batch as opened
 */

import { useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import {
  OpenPantryItemBatchDocument,
  type OpenPantryItemBatchMutation,
} from '#features/pantry/graphql/pantry.generated';
import { useErrorService } from '#/services/errorService';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

interface UseOpenPantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useOpenPantryItemBatch({
  onSuccess,
}: UseOpenPantryItemBatchOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [openMutation, { loading }] = useMutation(
    OpenPantryItemBatchDocument,
    {},
  );

  const openBatch = async (batchId: string): Promise<boolean> => {
    const now = new Date().toISOString();

    const optimisticResponse: OpenPantryItemBatchMutation = {
      __typename: 'Mutation',
      openPantryItemBatch: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: null,
      },
    };
    const result = await openMutation({
      variables: { input: { batchId } },
      optimisticResponse,
      update: cache => {
        // Optimistically update the batch in cache
        cache.modify({
          id: cache.identify({ __typename: 'PantryItemBatch', id: batchId }),
          fields: {
            isOpened: () => true,
            openedAt: () => now,
          },
        });

        // Persist optimistic state to survive cache-and-network refetches while offline
        optimisticDataPersistence.save(
          'PantryItemBatch',
          batchId,
          'isOpened',
          true,
        );
      },
    });

    if (result.data?.openPantryItemBatch?.pantryItem) {
      optimisticDataPersistence.clear('PantryItemBatch', batchId, 'isOpened');
      onSuccess?.();
      return true;
    }

    if (result.error) {
      const { message } = handleApolloError(result.error, {
        operation: 'Open Batch',
      });
      alertService.alert('Error', message);
    }

    return false;
  };

  return { openBatch, loading };
}

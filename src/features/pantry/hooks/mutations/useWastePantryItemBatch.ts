/**
 * useWastePantryItemBatch - Mutation hook for wasting a specific batch
 */

import { useMutation } from '@apollo/client/react';
import { WastePantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import type { WasteReason } from '#/graphql/generated/schemaTypes';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { handleMutationError } from '#/utils/errorHandlers';
import { isSuccessPayload } from '#/utils/compilerSafeWrappers';

interface UseWastePantryItemBatchOptions {
  onSuccess?: () => void;
}

export function useWastePantryItemBatch({
  onSuccess,
}: UseWastePantryItemBatchOptions = {}) {
  const [wasteMutation, { loading }] = useMutation(
    WastePantryItemBatchDocument,
  );

  const wasteBatch = async (
    batchId: string,
    wasteReason?: WasteReason,
    isComposted?: boolean,
    isRecycled?: boolean,
    notes?: string,
  ): Promise<boolean> => {
    const clearPersistence = optimisticDataPersistence.track(
      'PantryItemBatch',
      batchId,
      'isWasted',
      true,
    );

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

    if (
      isSuccessPayload(
        result.data?.wastePantryItemBatch,
        'WastePantryItemBatchPayload',
      )
    ) {
      clearPersistence();
      onSuccess?.();
      return true;
    }

    if (result.error) {
      handleMutationError(result.error, { operation: 'Waste Batch' });
    }

    return false;
  };

  return { wasteBatch, loading };
}

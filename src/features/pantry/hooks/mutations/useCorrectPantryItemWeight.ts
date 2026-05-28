/**
 * useCorrectPantryItemWeight - Mutation hook for correcting pantry item net weight
 *
 * Used after an item has been used (lastUsedAt is set).
 * Creates a WEIGHT_CORRECTED audit record with mandatory reason.
 */

import { useMutation } from '@apollo/client/react';
import { CorrectPantryItemWeightDocument } from '#features/pantry/graphql/pantry.generated';
import {
  handleMutationError,
  versionConflictCheck,
  invalidUnitCheck,
} from '#/utils/errorHandlers';
import { isSuccessPayload } from '#/utils/compilerSafeWrappers';

interface UseCorrectPantryItemWeightOptions {
  onSuccess?: () => void;
}

export function useCorrectPantryItemWeight({
  onSuccess,
}: UseCorrectPantryItemWeightOptions = {}) {
  const [correctMutation, { loading }] = useMutation(
    CorrectPantryItemWeightDocument,
  );

  const correctWeight = async (
    pantryItemId: string,
    netWeight: number,
    reason: string,
    version: number,
    netWeightUnitId?: string,
  ): Promise<boolean> => {
    const result = await correctMutation({
      variables: {
        input: {
          id: pantryItemId,
          netWeight,
          reason,
          version,
          ...(netWeightUnitId ? { netWeightUnitId } : {}),
        },
      },
    });

    if (
      isSuccessPayload(
        result.data?.correctPantryItemWeight,
        'CorrectPantryItemWeightPayload',
      )
    ) {
      onSuccess?.();
      return true;
    }

    if (result.error) {
      handleMutationError(result.error, {
        operation: 'Correct Weight',
        checks: [versionConflictCheck(), invalidUnitCheck()],
      });
    }

    return false;
  };

  return { correctWeight, loading };
}

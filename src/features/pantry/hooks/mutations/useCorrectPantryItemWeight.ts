/**
 * useCorrectPantryItemWeight - Mutation hook for correcting pantry item net weight
 *
 * Used after an item has been used (lastUsedAt is set).
 * Creates a WEIGHT_CORRECTED audit record with mandatory reason.
 */

import { useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { CorrectPantryItemWeightDocument } from '#features/pantry/graphql/pantry.generated';
import { PantryItemDisplayFragmentDoc } from '#features/pantry/graphql/pantryFragments.generated';
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import {
  isInvalidUnitError,
  getInvalidUnitMessage,
} from '#/utils/errors/invalidUnit';

interface UseCorrectPantryItemWeightOptions {
  onSuccess?: () => void;
}

export function useCorrectPantryItemWeight({
  onSuccess,
}: UseCorrectPantryItemWeightOptions = {}) {
  const { handleApolloError } = useErrorService();

  const [correctMutation, { loading }] = useMutation(
    CorrectPantryItemWeightDocument,
    {
      update: (cache, { data }) => {
        const pantryItem = data?.correctPantryItemWeight?.pantryItem;
        if (!pantryItem) return;

        cache.writeFragment({
          id: cache.identify({
            __typename: 'PantryItem',
            id: pantryItem.id,
          }),
          fragment: PantryItemDisplayFragmentDoc,
          fragmentName: 'PantryItemDisplay',
          data: pantryItem,
        });
      },
    },
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
        id: pantryItemId,
        input: {
          netWeight,
          reason,
          version,
          ...(netWeightUnitId ? { netWeightUnitId } : {}),
        },
      },
    });

    if (result.data?.correctPantryItemWeight?.pantryItem) {
      onSuccess?.();
      return true;
    }

    if (result.error) {
      if (handleVersionConflict(result.error)) {
        alertService.alert(
          'Item Updated',
          getVersionConflictMessage(result.error),
        );
      } else if (isInvalidUnitError(result.error)) {
        alertService.alert('Invalid Unit', getInvalidUnitMessage(result.error));
      } else {
        const { message } = handleApolloError(result.error, {
          operation: 'Correct Weight',
        });
        alertService.alert('Error', message);
      }
    }

    return false;
  };

  return { correctWeight, loading };
}

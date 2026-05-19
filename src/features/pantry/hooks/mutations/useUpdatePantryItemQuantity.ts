/**
 * useUpdatePantryItemQuantity - Update mutation for pantry item quantity/unit
 *
 * Single responsibility:
 * - Update quantity and unit fields via dedicated endpoint
 * - Version conflict handling
 * - Optimistic response built from the hook's own narrow fragment read from
 *   cache — callers pass only `itemId`.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { UpdatePantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
  type UseUpdatePantryItemQuantity_PantryItemFragment,
} from './useUpdatePantryItemQuantity.generated';
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { buildOptimisticUnit } from './utils';
import type { UnitSelection } from './types';

interface UseUpdatePantryItemQuantityOptions {
  onSuccess?: () => void;
  refetch?: () => void;
}

interface UpdateQuantityParams {
  itemId: string;
  quantityInput: string;
  quantityValue: number;
  unitId: string | null;
  unitSymbol: string;
  trackingUnit: UnitSelection;
}

export function useUpdatePantryItemQuantity({
  onSuccess,
  refetch,
}: UseUpdatePantryItemQuantityOptions) {
  const { handleApolloError } = useErrorService();
  const client = useApolloClient();

  const [updateQuantityMutation] = useMutation(
    UpdatePantryItemQuantityDocument,
    {
      onError: error => {
        if (handleVersionConflict(error)) {
          alertService.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetch?.() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        const { message } = handleApolloError(error, {
          operation: 'Update Quantity',
        });
        alertService.alert('Error', message);
      },
    },
  );

  /**
   * Update quantity and/or unit of a pantry item
   * Fires mutation asynchronously - doesn't await to allow immediate navigation
   */
  const updateQuantity = ({
    itemId,
    quantityInput,
    quantityValue,
    unitId,
    trackingUnit,
  }: UpdateQuantityParams): void => {
    const currentItem =
      client.cache.readFragment<UseUpdatePantryItemQuantity_PantryItemFragment>(
        {
          id: client.cache.identify({ __typename: 'PantryItem', id: itemId }),
          fragment: UseUpdatePantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useUpdatePantryItemQuantity_pantryItem',
        },
      );

    if (!currentItem) {
      console.warn('Item not found, cannot update quantity:', itemId);
      return;
    }

    const newQuantity = parseFloat(quantityInput || quantityValue.toString());

    // Fire mutation asynchronously - don't await to allow immediate navigation
    const optimisticPantryItem = enhanceWithVersion(currentItem, {
      quantity: newQuantity,
      unit: buildOptimisticUnit(trackingUnit, currentItem.unit),
    });
    updateQuantityMutation({
      variables: {
        pantryItemId: itemId,
        quantity: quantityInput || quantityValue.toString(),
        unitId: unitId,
        version: currentItem.version ?? undefined,
      },
      optimisticResponse: {
        __typename: 'Mutation',
        updatePantryItemQuantity: {
          __typename: 'PantryItemPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          pantryItem: optimisticPantryItem,
        },
      },
    }).catch(error => {
      console.error('Quantity update failed:', error);
      // Error already handled by mutation's onError
    });

    onSuccess?.();
  };

  return { updateQuantity };
}

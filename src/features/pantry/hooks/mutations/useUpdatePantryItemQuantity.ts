/**
 * useUpdatePantryItemQuantity - Update mutation for pantry item quantity/unit
 *
 * Single responsibility:
 * - Update quantity and unit fields via dedicated endpoint
 * - Version conflict handling
 * - Optimistic response with cache update
 */

import { alertService } from '#/services/alertService';
import {
  useUpdatePantryItemQuantityMutation,
  PantryItemDisplayFragmentDoc,
  PantryItemFragment,
} from '#generated';
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { buildOptimisticMutationResponse } from '#/apollo/utils/optimisticTypes';
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
  currentItem: PantryItemFragment;
}

/**
 * Hook for updating pantry item quantity and unit
 *
 * @example
 * ```tsx
 * const { updateQuantity } = useUpdatePantryItemQuantity({ onSuccess, refetch });
 * updateQuantity({
 *   itemId: 'item-123',
 *   quantityInput: '2.5',
 *   quantityValue: 2.5,
 *   unitId: 'unit-456',
 *   unitSymbol: 'kg',
 *   trackingUnit,
 *   currentItem,
 * });
 * ```
 */
export function useUpdatePantryItemQuantity({
  onSuccess,
  refetch,
}: UseUpdatePantryItemQuantityOptions) {
  const { handleApolloError } = useErrorService();

  const [updateQuantityMutation] = useUpdatePantryItemQuantityMutation({
    errorPolicy: 'all',
    update: (cache, { data }) => {
      const pantryItem = data?.updatePantryItemQuantity?.pantryItem;
      if (!pantryItem) return;

      cache.writeFragment({
        id: cache.identify({ __typename: 'PantryItem', id: pantryItem.id }),
        fragment: PantryItemDisplayFragmentDoc,
        fragmentName: 'PantryItemDisplay',
        data: pantryItem,
      });
    },
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
  });

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
    currentItem,
  }: UpdateQuantityParams): void => {
    const newQuantity = parseFloat(quantityInput || quantityValue.toString());

    // Fire mutation asynchronously - don't await to allow immediate navigation
    updateQuantityMutation({
      variables: {
        pantryItemId: itemId,
        quantity: quantityInput || quantityValue.toString(),
        unitId: unitId,
        version: currentItem.version ?? undefined,
      },
      optimisticResponse: buildOptimisticMutationResponse(
        'updatePantryItemQuantity',
        'PantryItemPayload',
        'pantryItem',
        enhanceWithVersion(currentItem, {
          quantity: newQuantity,
          unit: buildOptimisticUnit(trackingUnit, currentItem.unit),
        }),
      ),
    }).catch(error => {
      console.error('Quantity update failed:', error);
      // Error already handled by mutation's onError
    });

    onSuccess?.();
  };

  return { updateQuantity };
}

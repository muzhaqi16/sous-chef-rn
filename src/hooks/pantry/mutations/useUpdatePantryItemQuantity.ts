/**
 * useUpdatePantryItemQuantity - Update mutation for pantry item quantity/unit
 *
 * Single responsibility:
 * - Update quantity and unit fields via dedicated endpoint
 * - Version conflict handling
 * - Optimistic response with cache update
 */

import { Alert } from 'react-native';
import {
  useUpdatePantryItemQuantityMutation,
  PantryItemFragmentDoc,
  PantryItemFragment,
} from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
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
  const { handleApolloError } = useErrorHandler();

  const [updateQuantityMutation] = useUpdatePantryItemQuantityMutation({
    errorPolicy: 'all',
    // Ensure full fragment including nested item.nutritions is written to cache
    update: (cache, { data }) => {
      if (!data?.updatePantryItemQuantity) return;

      cache.writeFragment({
        id: cache.identify({ __typename: 'PantryItem', id: data.updatePantryItemQuantity.id }),
        fragment: PantryItemFragmentDoc,
        fragmentName: 'PantryItemFragment',
        data: data.updatePantryItemQuantity,
      });
    },
    onError: error => {
      if (handleVersionConflict(error)) {
        Alert.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch?.() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
      const { message } = handleApolloError(error, {
        operation: 'Update Quantity',
      });
      Alert.alert('Error', message);
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
    unitSymbol,
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
      optimisticResponse: {
        __typename: 'Mutation',
        updatePantryItemQuantity: enhanceWithVersion(currentItem as any, {
          quantity: newQuantity,
          unit: buildOptimisticUnit(trackingUnit, currentItem.unit),
          unitId: unitId || currentItem.unitId,
          unitName: unitSymbol || currentItem.unitName,
        }),
      },
    }).catch(error => {
      console.error('Quantity update failed:', error);
      // Error already handled by mutation's onError
    });

    onSuccess?.();
  };

  return { updateQuantity };
}

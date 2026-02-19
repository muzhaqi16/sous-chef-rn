/**
 * useUpdatePantryItem - Update mutation for pantry item non-quantity fields
 *
 * Single responsibility:
 * - Update non-quantity fields (storage, notes, tags, brand, etc.)
 * - Only sends changed fields (dirty field tracking)
 * - Version conflict handling
 * - Optimistic response with cache update
 */

import { Alert } from 'react-native';
import {
  useUpdatePantryItemMutation,
  PantryItemFragmentDoc,
  PantryItemFragment,
} from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { buildOptimisticMutationResponse } from '#/apollo/utils/optimisticTypes';
import { buildDirtyUpdateInput } from './utils';
import type { FormDataInput } from './types';

interface UseUpdatePantryItemOptions {
  onSuccess?: () => void;
  refetch?: () => void;
}

interface UpdatePantryItemFieldsParams {
  itemId: string;
  input: FormDataInput;
  currentItem: PantryItemFragment;
  dirtyFields: Record<string, boolean>;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
}

/**
 * Hook for updating pantry item non-quantity fields
 *
 * @example
 * ```tsx
 * const { updatePantryItemFields } = useUpdatePantryItem({ onSuccess, refetch });
 * updatePantryItemFields({
 *   itemId: 'item-123',
 *   input: formData,
 *   currentItem,
 *   dirtyFields,
 *   selectedLocationId: null,
 *   selectedBrandId: null,
 * });
 * ```
 */
export function useUpdatePantryItem({
  onSuccess,
  refetch,
}: UseUpdatePantryItemOptions) {
  const { handleApolloError } = useErrorHandler();

  const [updateMutation] = useUpdatePantryItemMutation({
    errorPolicy: 'all',
    // Ensure full fragment including nested item.nutritions is written to cache
    update: (cache, { data }) => {
      const pantryItem = data?.updatePantryItem?.pantryItem;
      if (!pantryItem) return;

      cache.writeFragment({
        id: cache.identify({ __typename: 'PantryItem', id: pantryItem.id }),
        fragment: PantryItemFragmentDoc,
        fragmentName: 'PantryItemFragment',
        data: pantryItem,
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
        operation: 'Update Pantry Item',
      });
      Alert.alert('Error', message);
    },
  });

  /**
   * Update non-quantity fields of a pantry item
   * Fires mutation asynchronously - doesn't await to allow immediate navigation
   */
  const updatePantryItemFields = ({
    itemId,
    input,
    currentItem,
    dirtyFields,
    selectedLocationId,
    selectedBrandId,
  }: UpdatePantryItemFieldsParams): void => {
    // Build input for dirty fields only
    const updateInput = buildDirtyUpdateInput(
      input,
      dirtyFields,
      selectedLocationId,
      selectedBrandId,
    );

    // Only fire mutation if there are changes
    if (Object.keys(updateInput).length === 0) {
      onSuccess?.();
      return;
    }

    // Build optimistic update with brand handling
    const optimisticUpdate: Record<string, any> = { ...updateInput };
    if ('brandId' in updateInput && updateInput.brandId === null) {
      optimisticUpdate.brand = null;
    }

    // Fire mutation asynchronously - don't await to allow immediate navigation
    updateMutation({
      variables: { id: itemId, input: updateInput },
      optimisticResponse: buildOptimisticMutationResponse(
        'updatePantryItem',
        'PantryItemPayload',
        'pantryItem',
        enhanceWithVersion(currentItem, optimisticUpdate),
      ),
    }).catch(error => {
      console.error('Pantry item update failed:', error);
      // Error already handled by mutation's onError
    });

    onSuccess?.();
  };

  return { updatePantryItemFields };
}

/**
 * useCreatePantryItem - Create mutation for pantry items
 *
 * Single responsibility:
 * - Create mutation with cache update
 * - Handles both existing item linking and new item creation
 * - Storage location resolution (ID vs name)
 * - Category resolution (ID vs name)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useCreatePantryItemMutation } from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import { addToPantryItemsCache } from './utils';
import type { CreatePantryItemParams } from './types';

interface UseCreatePantryItemOptions {
  pantryId: string | undefined;
  onSuccess?: () => void;
}

/**
 * Hook for creating pantry items
 *
 * @example
 * ```tsx
 * const { createPantryItem } = useCreatePantryItem({ pantryId, onSuccess });
 * await createPantryItem({
 *   input: formData,
 *   pantryId,
 *   quantityValue: 2,
 *   unitId: 'unit-123',
 *   selectedLocationId: null,
 *   selectedCategoryId: null,
 * });
 * ```
 */
export function useCreatePantryItem({
  pantryId,
  onSuccess,
}: UseCreatePantryItemOptions) {
  const { handleApolloError } = useErrorHandler();

  const [createMutation] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    update: (cache, { data: mutationData }) => {
      if (!mutationData?.createPantryItem || !pantryId) return;

      try {
        addToPantryItemsCache(cache, pantryId, mutationData.createPantryItem);
      } catch (error) {
        console.warn('Cache update failed:', error);
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Create Pantry Item',
      });
      Alert.alert('Error', message);
    },
  });

  const createPantryItem = useCallback(
    async ({
      input,
      pantryId: targetPantryId,
      quantityValue,
      unitId,
      selectedLocationId,
      selectedCategoryId,
    }: CreatePantryItemParams): Promise<boolean> => {
      if (!input.itemName?.trim()) {
        Alert.alert('Error', 'Please enter an item name');
        return false;
      }

      const storageLocationInput = selectedLocationId
        ? { storageLocationId: selectedLocationId }
        : input.location.trim()
        ? { storageLocationName: input.location.trim() }
        : {};

      const baseInput = {
        pantryId: targetPantryId,
        unitId: unitId || '',
        quantity: quantityValue,
        storageState: input.storageState,
        expiresAt: input.expirationDate?.toISOString() || null,
        storageNotes: input.notes.trim() || null,
        minQuantity: input.minQuantity
          ? parseFloat(input.minQuantity)
          : undefined,
        restockQuantity: input.restockQuantity
          ? parseFloat(input.restockQuantity)
          : undefined,
        ...storageLocationInput,
      };

      let mutationInput: any;

      if (input.selectedItemId) {
        // Linking to existing catalog item
        mutationInput = {
          ...baseInput,
          itemId: input.selectedItemId,
        };
      } else {
        // Creating new item
        const categoryInput = selectedCategoryId
          ? { itemCategory: selectedCategoryId }
          : input.category.trim()
          ? { itemCategory: input.category.trim() }
          : {};

        mutationInput = {
          ...baseInput,
          itemName: input.itemName.trim(),
          itemDescription: input.notes.trim() || null,
          itemBrand: input.brand?.trim() || null,
          ...categoryInput,
        };
      }

      const result = await createMutation({
        variables: { input: mutationInput },
      });

      if (result.data?.createPantryItem) {
        onSuccess?.();
        return true;
      }

      return false;
    },
    [createMutation, onSuccess],
  );

  return { createPantryItem };
}

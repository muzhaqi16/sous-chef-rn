/**
 * useCreatePantryItem - Create mutation for pantry items
 *
 * Single responsibility:
 * - Create mutation with cache update
 * - Handles both existing item linking and new item creation
 * - Storage location resolution (ID vs name)
 * - Category resolution (ID vs name)
 * - Handles PANTRY_ITEM_ALREADY_EXISTS with restock/force-add options
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useCreatePantryItemMutation,
  useRestockPantryItemMutation,
} from '#generated';
import { useErrorService } from '#/services/errorService';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
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
  const { handleApolloError } = useErrorService();

  const [createMutation] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    update: (cache, { data: mutationData }) => {
      const pantryItem = mutationData?.createPantryItem?.pantryItem;
      if (!pantryItem || !pantryId) return;

      try {
        addToPantryItemsCache(cache, pantryId, pantryItem);
      } catch (error) {
        console.warn('Cache update failed:', error);
      }
    },
  });

  const [restockMutation] = useRestockPantryItemMutation({
    errorPolicy: 'all',
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
        ...(unitId && { unit: { unitId } }),
        quantity: quantityValue,
        storage: {
          storageState: input.storageState,
          storageNotes: input.notes.trim() || null,
          ...storageLocationInput,
        },
        expiresAt: input.expirationDate?.toISOString() || null,
        ...(input.minQuantity || input.restockQuantity
          ? {
              thresholds: {
                ...(input.minQuantity && {
                  minQuantity: parseFloat(input.minQuantity),
                }),
                ...(input.restockQuantity && {
                  restockQuantity: parseFloat(input.restockQuantity),
                }),
              },
            }
          : {}),
        ...(input.netWeight
          ? {
              netWeight: {
                netWeight: parseFloat(input.netWeight),
                ...(input.netWeightUnitId && {
                  netWeightUnitId: input.netWeightUnitId,
                }),
              },
            }
          : {}),
      };

      let mutationInput: any;

      if (input.selectedItemId) {
        // Linking to existing catalog item
        mutationInput = {
          ...baseInput,
          itemId: input.selectedItemId,
        };
      } else {
        // Creating new item via inline item input
        const category = selectedCategoryId
          ? selectedCategoryId
          : input.category.trim() || undefined;

        mutationInput = {
          ...baseInput,
          item: {
            name: input.itemName.trim(),
            description: input.notes.trim() || null,
            ...(input.brand?.trim() && { brand: input.brand.trim() }),
            ...(category && { category }),
          },
        };
      }

      const result = await createMutation({
        variables: { input: mutationInput },
      });

      if (result.data?.createPantryItem?.success) {
        onSuccess?.();
        return true;
      }

      // Check for duplicate pantry item error
      if (result.error && isPantryItemDuplicateError(result.error)) {
        const duplicateInfo = getPantryItemDuplicateInfo(result.error);
        if (duplicateInfo) {
          return new Promise<boolean>(resolve => {
            Alert.alert(
              'Item Already in Pantry',
              'This item is already in your pantry. Would you like to restock it or add a separate entry?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve(false),
                },
                {
                  text: 'Restock',
                  onPress: async () => {
                    try {
                      await restockMutation({
                        variables: {
                          id: duplicateInfo.existingPantryItemId,
                          input: { quantity: quantityValue ?? 1 },
                        },
                      });
                      onSuccess?.();
                      resolve(true);
                    } catch {
                      Alert.alert('Error', 'Failed to restock item. Please try again.');
                      resolve(false);
                    }
                  },
                },
                {
                  text: 'Add Anyway',
                  onPress: async () => {
                    try {
                      const retryResult = await createMutation({
                        variables: {
                          input: { ...mutationInput, forceAdd: true },
                        },
                      });
                      if (retryResult.data?.createPantryItem?.success) {
                        onSuccess?.();
                        resolve(true);
                      } else {
                        Alert.alert('Error', 'Failed to add item. Please try again.');
                        resolve(false);
                      }
                    } catch {
                      Alert.alert('Error', 'Failed to add item. Please try again.');
                      resolve(false);
                    }
                  },
                },
              ],
            );
          });
        }
      }

      // Non-duplicate error
      if (result.error) {
        const { message } = handleApolloError(result.error, {
          operation: 'Create Pantry Item',
        });
        Alert.alert('Error', message);
      }

      return false;
    },
    [createMutation, restockMutation, onSuccess, handleApolloError],
  );

  return { createPantryItem };
}

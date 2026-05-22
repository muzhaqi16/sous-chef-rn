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

import { useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type { CreatePantryItemInput } from '#/graphql/generated/schemaTypes';
import { useErrorService } from '#/services/errorService';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
import { addToPantryItemsCache } from './utils';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
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

  const [createMutation] = useMutation(CreatePantryItemDocument, {
    update: (cache, { data: mutationData }) => {
      const payload = mutationData?.createPantryItem;
      if (payload?.__typename !== 'CreatePantryItemSuccess' || !pantryId)
        return;
      const pantryItem = payload.pantryItem;

      executeCacheUpdate(
        () => addToPantryItemsCache(cache, pantryId, pantryItem),
        'Cache update failed:',
      );
    },
  });

  const [restockMutation] = useMutation(RestockPantryItemDocument, {});

  const createPantryItem = async ({
    input,
    pantryId: targetPantryId,
    quantityValue,
    unitId,
    selectedLocationId,
    selectedCategoryId,
  }: CreatePantryItemParams): Promise<boolean> => {
    if (!input.itemName?.trim()) {
      alertService.alert('Error', 'Please enter an item name');
      return false;
    }

    const storageLocationInput = selectedLocationId
      ? { storageLocationId: selectedLocationId }
      : input.location.trim()
      ? { storageLocationName: input.location.trim() }
      : {};

    const baseInput = {
      pantryId: targetPantryId,
      ...(unitId
        ? { unit: { unitId } }
        : input.unit?.trim()
        ? { unit: { unitSymbol: input.unit.trim() } }
        : {}),
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

    let mutationInput: CreatePantryItemInput;

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

    if (
      result.data?.createPantryItem?.__typename === 'CreatePantryItemSuccess'
    ) {
      onSuccess?.();
      return true;
    }

    // Check for duplicate pantry item error
    if (result.error && isPantryItemDuplicateError(result.error)) {
      const duplicateInfo = getPantryItemDuplicateInfo(result.error);
      if (duplicateInfo) {
        return new Promise<boolean>(resolve => {
          alertService.alert(
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
                  const restockQuantity = quantityValue ?? 1;
                  const restockResult = await executeMutation(
                    () =>
                      restockMutation({
                        variables: {
                          input: {
                            id: duplicateInfo.existingPantryItemId,
                            quantity: restockQuantity,
                          },
                        },
                      }),
                    'Restock pantry item error:',
                  );
                  if (!restockResult) {
                    alertService.alert(
                      'Error',
                      'Failed to restock item. Please try again.',
                    );
                    resolve(false);
                    return;
                  }
                  onSuccess?.();
                  resolve(true);
                },
              },
              {
                text: 'Add Anyway',
                onPress: async () => {
                  const retryResult = await executeMutation(
                    () =>
                      createMutation({
                        variables: {
                          input: { ...mutationInput, forceAdd: true },
                        },
                      }),
                    'Force add pantry item error:',
                  );
                  if (!retryResult) {
                    alertService.alert(
                      'Error',
                      'Failed to add item. Please try again.',
                    );
                    resolve(false);
                    return;
                  }
                  if (
                    retryResult.data?.createPantryItem?.__typename ===
                    'CreatePantryItemSuccess'
                  ) {
                    onSuccess?.();
                    resolve(true);
                  } else {
                    alertService.alert(
                      'Error',
                      'Failed to add item. Please try again.',
                    );
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
      alertService.alert('Error', message);
    }

    return false;
  };

  return { createPantryItem };
}

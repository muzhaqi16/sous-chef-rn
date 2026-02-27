/**
 * usePantryItemMutations - CRUD mutations for pantry items
 *
 * Single responsibility:
 * - Add, update, remove mutations
 * - Optimistic responses for instant UI
 * - Cache updates for offline-first support
 */

import { Alert } from 'react-native';
import { generateId } from '#/utils/generateId';
import {
  useCreatePantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
} from '#generated';
import { useErrorService } from '#/services/errorService';
import {
  enhanceWithVersion,
  createOptimisticEntity,
} from '#/apollo/utils/createOptimisticResponse';
import {
  buildOptimisticMutationResponse,
  buildOptimisticDeleteResponse,
} from '#/apollo/utils/optimisticTypes';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { addToPantryItemsCache, removeFromPantryItemsCache } from './utils';
import { executeCacheUpdate, executeMutationWithErrorHandler } from '#/utils/compilerSafeWrappers';
import type { PantryItemInput, PantryItemUpdate } from './types';
import type { PantryItemDisplayFragment } from '#generated';

interface UsePantryItemMutationsOptions {
  pantryId: string | undefined;
  pantryItems: PantryItemDisplayFragment[];
  refetch: () => Promise<void>;
}

/**
 * Hook for pantry item CRUD operations
 *
 * @example
 * ```tsx
 * const { addItem, updateItem, removeItem } = usePantryItemMutations({
 *   pantryId,
 *   pantryItems,
 *   refetch,
 * });
 * ```
 */
export function usePantryItemMutations({
  pantryId,
  pantryItems,
  refetch,
}: UsePantryItemMutationsOptions) {
  const { handleApolloError } = useErrorService();
  const { createAddOperation, createUpdateOperation } = useCrudOperations();

  // ADD MUTATION
  const [addItemMutation] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Add Pantry Item',
      });
      Alert.alert('Error', message);
    },
    optimisticResponse: (variables: any) => {
      const tempId = `temp-${generateId()}`;
      return buildOptimisticMutationResponse(
        'createPantryItem',
        'PantryItemPayload',
        'pantryItem',
        {
          ...createOptimisticEntity('PantryItem', tempId, {
            itemName: variables.input.itemName,
            quantity: variables.input.quantity || variables.input.initialQuantity,
            storageState: variables.input.storageState,
            storageLocation: variables.input.storageLocation || null,
            storageNotes: variables.input.storageNotes || null,
            expiresAt: variables.input.expiresAt || null,
            autoReorderPoint: variables.input.autoReorderPoint || null,
            pantry: {
              __typename: 'Pantry',
              id: pantryId || '',
            },
            unit: variables.input.unitId
              ? {
                  __typename: 'Unit',
                  id: variables.input.unitId,
                }
              : null,
          }),
          __typename: 'PantryItem' as const,
        },
      );
    },
    update: (cache: any, { data }: any) => {
      const pantryItem = data?.createPantryItem?.pantryItem;
      if (!pantryItem || !pantryId) return;

      executeCacheUpdate(
        () => addToPantryItemsCache(cache, pantryId, pantryItem),
        'Cache update failed for addItem, will refetch:',
        refetch,
      );
    },
  });

  // UPDATE MUTATION
  const [updateItemMutation] = useUpdatePantryItemMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      if (handleVersionConflict(error)) {
        Alert.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      const { message } = handleApolloError(error, {
        operation: 'Update Pantry Item',
      });
      Alert.alert('Error', message);
    },
    optimisticResponse: variables => {
      const currentItem = pantryItems.find(item => item.id === variables.id);

      if (!currentItem) {
        return buildOptimisticMutationResponse(
          'updatePantryItem',
          'PantryItemPayload',
          'pantryItem',
          {
            __typename: 'PantryItem' as const,
            id: variables.id,
            version: 1,
            updatedAt: new Date().toISOString(),
            ...variables.input,
          },
        );
      }

      const optimisticUpdate = enhanceWithVersion(
        {
          ...currentItem,
          updatedAt: currentItem.updatedAt ?? new Date().toISOString(),
        },
        // Input types use InputMaybe (T | null | undefined) while fragment types
        // don't accept null — safe to cast since this is an optimistic prediction
        variables.input as Partial<typeof currentItem>,
      );

      return buildOptimisticMutationResponse(
        'updatePantryItem',
        'PantryItemPayload',
        'pantryItem',
        optimisticUpdate,
      );
    },
  });

  // REMOVE MUTATION
  const [removeItemMutation] = useDeletePantryItemMutation({
    errorPolicy: 'all',
    optimisticResponse: variables =>
      buildOptimisticDeleteResponse(
        'deletePantryItem',
        'PantryItemPayload',
        'pantryItem',
        'PantryItem',
        variables.id,
      ),
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Pantry Item',
      });
      Alert.alert('Error', message);
      refetch(); // Restore state on error
    },
    update: (cache: any, { data }: any, { variables }: any) => {
      if (!data?.deletePantryItem?.pantryItem || !pantryId || !variables) {
        return;
      }

      const itemId = variables.id;
      removeFromPantryItemsCache(cache, pantryId, itemId, { evictItem: true });
    },
  });

  // WRAPPED OPERATIONS

  const addItem = createAddOperation({
    mutation: addItemMutation,
    parentId: () => pantryId,
    transformInput: (input: PantryItemInput) => ({
      pantryId,
      quantity: input.quantity,
      item: {
        name: input.itemName,
        ...(input.category && { category: input.category }),
        ...(input.barcode && { upc: input.barcode }),
        ...(input.brand && { brand: input.brand }),
      },
      ...(input.unitId && { unit: { unitId: input.unitId } }),
      storage: {
        storageState: input.storageState,
        ...(input.location && { storageLocationName: input.location }),
        ...(input.notes && { storageNotes: input.notes }),
      },
      ...(input.expirationDate && { expiresAt: input.expirationDate }),
    }),
    onSuccess: (data: any) => data?.createPantryItem?.pantryItem,
    operationName: 'Add Pantry Item',
  });

  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    const operation = createUpdateOperation({
      mutation: updateItemMutation,
      parentId: () => pantryId,
      itemId,
      onSuccess: (data: any) => data?.updatePantryItem?.pantryItem,
      onVersionConflict: refetch,
      operationName: 'Update Pantry Item',
    });
    return operation(updates);
  };

  const removeItem = async (itemId: string): Promise<void> => {
    if (!pantryId) {
      return;
    }

    // Register pending delete to handle subscription race condition
    subscriptionService.registerPendingDelete(
      itemId,
      pantryId,
      'PantryItem',
      'Pantry',
      'itemsConnection',
    );

    const result = await executeMutationWithErrorHandler(
      () => removeItemMutation({
        variables: { id: itemId },
      }),
      (error) => {
        subscriptionService.unregisterPendingDelete(itemId);
        throw error;
      },
    );
    if (result) {
      subscriptionService.unregisterPendingDelete(itemId);
    }
  };

  return {
    addItem,
    updateItem,
    removeItem,
  };
}

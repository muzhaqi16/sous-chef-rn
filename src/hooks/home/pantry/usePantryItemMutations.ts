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
import { useErrorHandler } from '#/utils/errorHandling';
import {
  enhanceWithVersion,
  createOptimisticEntity,
} from '#/apollo/utils/createOptimisticResponse';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { addToPantryItemsCache, removeFromPantryItemsCache } from './utils';
import type { PantryItemInput, PantryItemUpdate } from './types';

interface UsePantryItemMutationsOptions {
  pantryId: string | undefined;
  pantryItems: any[];
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
  const { handleApolloError } = useErrorHandler();
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
      return {
        __typename: 'Mutation' as const,
        createPantryItem: {
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
        } as any,
      };
    },
    update: (cache: any, { data }: any) => {
      if (!data?.createPantryItem || !pantryId) return;

      try {
        addToPantryItemsCache(cache, pantryId, data.createPantryItem);
      } catch (error) {
        console.warn('Cache update failed for addItem, will refetch:', error);
        refetch();
      }
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
        return {
          __typename: 'Mutation',
          updatePantryItem: {
            __typename: 'PantryItem',
            id: variables.id,
            version: 1,
            updatedAt: new Date().toISOString(),
            ...variables.input,
          } as any,
        };
      }

      const optimisticUpdate = enhanceWithVersion(
        {
          ...currentItem,
          updatedAt: currentItem.updatedAt ?? new Date().toISOString(),
        } as any,
        {
          ...variables.input,
        },
      );

      return {
        __typename: 'Mutation',
        updatePantryItem: optimisticUpdate as any,
      };
    },
  });

  // REMOVE MUTATION
  const [removeItemMutation, { client }] = useDeletePantryItemMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Pantry Item',
      });
      Alert.alert('Error', message);
    },
    update: (cache: any, { data }: any, { variables }: any) => {
      if (!data?.deletePantryItem || !pantryId || !variables) return;

      try {
        const itemId = variables.id;
        removeFromPantryItemsCache(cache, pantryId, itemId, { evictItem: true });
      } catch (error) {
        console.warn('Cache update failed for removeItem, will refetch:', error);
        refetch();
      }
    },
  });

  // WRAPPED OPERATIONS

  const addItem = createAddOperation({
    mutation: addItemMutation,
    parentId: () => pantryId,
    transformInput: (input: PantryItemInput) => ({
      pantryId,
      quantity: input.quantity,
      itemName: input.itemName,
      unitId: input.unitId,
      storageState: input.storageState,
      ...(input.brand && { itemBrand: input.brand }),
      ...(input.location && { storageLocation: input.location }),
      ...(input.expirationDate && { expiresAt: input.expirationDate }),
      ...(input.notes && { storageNotes: input.notes }),
      ...(input.category && { itemCategory: input.category }),
      ...(input.barcode && { itemUpc: input.barcode }),
    }),
    onSuccess: (data: any) => data?.createPantryItem,
    operationName: 'Add Pantry Item',
  });

  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    const operation = createUpdateOperation({
      mutation: updateItemMutation,
      parentId: () => pantryId,
      itemId,
      onSuccess: (data: any) => data?.updatePantryItem,
      onVersionConflict: refetch,
      operationName: 'Update Pantry Item',
    });
    return operation(updates);
  };

  const removeItem = async (itemId: string) => {
    if (!pantryId) return;

    // Register pending delete to handle subscription race condition
    subscriptionService.registerPendingDelete(
      itemId,
      pantryId,
      'PantryItem',
      'Pantry',
      'itemsConnection',
    );

    // Optimistically remove from cache IMMEDIATELY
    removeFromPantryItemsCache(client.cache, pantryId, itemId, { evictItem: true });

    try {
      const result = await removeItemMutation({
        variables: { id: itemId },
      });

      if (result.error) {
        console.warn('Delete mutation had errors, refetching to restore state');
        refetch();
      }
    } catch (error) {
      console.warn('Delete mutation failed, refetching to restore state:', error);
      refetch();
    } finally {
      subscriptionService.unregisterPendingDelete(itemId);
    }
  };

  return {
    addItem,
    updateItem,
    removeItem,
  };
}

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { generateId } from '#/utils/generateId';
import {
  useCreatePantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
  StorageState,
} from '#generated';
import type { PantryItem } from '#/graphql/generated/types';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  enhanceWithVersion,
  createOptimisticEntity,
} from '#/apollo/utils/createOptimisticResponse';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { useCrudOperations } from '#/hooks/utils';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils';

// Cache updater utilities for pantry items
const addToPantryItemsCache = createAddToParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

const removeFromPantryItemsCache = createRemoveFromParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

export interface PantryItemInput {
  itemName: string;
  brand?: string;
  quantity: number;
  unit?: string;
  unitId: string;
  autoReorderPoint?: number;
  storageState: StorageState;
  location?: string;
  expirationDate?: string;
  notes?: string;
  category?: string;
  barcode?: string;
  imageUrl?: string;
}

export interface PantryItemUpdate extends Partial<PantryItemInput> {
  currentQuantity?: number;
}

interface UsePantryMutationsProps {
  pantryId: string | undefined;
  items: PantryItem[];
  refetch: () => void;
}

/**
 * Hook for pantry CRUD mutations
 * Handles create, update, and delete operations with optimistic responses
 */
export function usePantryMutations({
  pantryId,
  items,
  refetch,
}: UsePantryMutationsProps) {
  const { handleApolloError } = useErrorHandler();
  const { createAddOperation, createUpdateOperation, createRemoveOperation } =
    useCrudOperations();

  // Create mutation
  const [addItemMutation] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Add Pantry Item',
      });
      Alert.alert('Error', message);
    },
    // Optimistic response for instant UI feedback (especially important offline)
    optimisticResponse: (variables: any) => {
      const tempId = `temp-${generateId()}`;
      return {
        __typename: 'Mutation' as const,
        createPantryItem: {
          ...createOptimisticEntity('PantryItem', tempId, {
            itemName: variables.input.itemName,
            currentQuantity: variables.input.initialQuantity,
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
    // Update Apollo cache using generic utility
    update: (cache: any, { data }: any) => {
      if (!data?.createPantryItem || !pantryId) return;

      try {
        addToPantryItemsCache(cache, pantryId, data.createPantryItem);
      } catch (error) {
        console.warn('Cache update failed for addItem, will refetch:', error);
        // Fallback: refetch if cache update fails
        refetch();
      }
    },
  });

  // Update mutation
  const [updateItemMutation] = useUpdatePantryItemMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      // Handle version conflicts with user-friendly message
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
    // Enhanced optimistic response with version management
    optimisticResponse: variables => {
      // Find the current item to preserve its fields
      const currentItem = items.find(item => item.id === variables.id);

      if (!currentItem) {
        // Fallback for edge case where item not in cache
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

      // Use version-aware helper to create optimistic response
      // This automatically increments version and updates timestamp
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
    // Cache update happens automatically via Apollo's normalization
  });

  // Delete mutation
  const [removeItemMutation] = useDeletePantryItemMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Pantry Item',
      });
      Alert.alert('Error', message);
    },
    // Update cache using generic utility
    update: (cache: any, { data }: any, { variables }: any) => {
      if (!data?.deletePantryItem || !pantryId || !variables) return;

      try {
        const itemId = variables.id;
        removeFromPantryItemsCache(cache, pantryId, itemId, { evictItem: true });
      } catch (error) {
        console.warn(
          'Cache update failed for removeItem, will refetch:',
          error,
        );
        refetch();
      }
    },
  });

  // Simplified add item using CRUD utilities
  const addItem = createAddOperation({
    mutation: addItemMutation,
    parentId: () => pantryId,
    transformInput: (input: PantryItemInput) => ({
      pantryId,
      initialQuantity: input.quantity,
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

  // Simplified update item using CRUD utilities
  const updateItem = useCallback(async (itemId: string, updates: PantryItemUpdate) => {
    const operation = createUpdateOperation({
      mutation: updateItemMutation,
      parentId: () => pantryId,
      itemId,
      onSuccess: (data: any) => data?.updatePantryItem,
      onVersionConflict: refetch,
      operationName: 'Update Pantry Item',
    });
    return operation(updates);
  }, [createUpdateOperation, updateItemMutation, pantryId, refetch]);

  // Simplified remove item using CRUD utilities
  const removeItem = useCallback(async (itemId: string) => {
    const operation = createRemoveOperation({
      mutation: removeItemMutation,
      parentId: () => pantryId,
      itemId,
      operationName: 'Delete Pantry Item',
    });
    return operation();
  }, [createRemoveOperation, removeItemMutation, pantryId]);

  return {
    addItem,
    updateItem,
    removeItem,
  };
}

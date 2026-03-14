/**
 * usePantryItemMutations - CRUD mutations for pantry items
 *
 * Single responsibility:
 * - Add, update, remove mutations
 * - Optimistic responses for instant UI
 * - Cache updates for offline-first support
 */

import { alertService } from '#/services/alertService';
import { generateId } from '#/utils/generateId';
import {
  useCreatePantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
  type CreatePantryItemMutation,
  type CreatePantryItemMutationVariables,
  type UpdatePantryItemMutation,
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
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
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
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Add Pantry Item',
      });
      alertService.alert('Error', message);
    },
    optimisticResponse: (variables: CreatePantryItemMutationVariables) => {
      const tempId = `temp-${generateId()}`;
      const input = variables.input;
      return buildOptimisticMutationResponse(
        'createPantryItem',
        'PantryItemPayload',
        'pantryItem',
        {
          ...createOptimisticEntity('PantryItem', tempId, {
            itemName: input.item?.name ?? '',
            quantity: input.quantity ?? 1,
            storageState: input.storage?.storageState ?? null,
            storageLocation: input.storage?.storageLocationName ?? null,
            storageNotes: input.storage?.storageNotes ?? null,
            expiresAt: input.expiresAt ?? null,
            autoReorderPoint: null,
            pantry: {
              __typename: 'Pantry',
              id: pantryId || '',
            },
            unit: input.unit?.unitId
              ? {
                  __typename: 'Unit',
                  id: input.unit.unitId,
                }
              : null,
          }),
          __typename: 'PantryItem',
        },
      );
    },
    update: (cache, { data }) => {
      const pantryItem = data?.createPantryItem?.pantryItem;
      if (!pantryItem || !pantryId) return;

      executeCacheUpdate(
        () => {
          addToPantryItemsCache(cache, pantryId, pantryItem);
          cache.modify({
            id: cache.identify({ __typename: 'Pantry', id: pantryId }),
            fields: {
              stats(existingStats: any) {
                if (!existingStats) return existingStats;
                return {
                  ...existingStats,
                  totalItems: (existingStats.totalItems || 0) + 1,
                };
              },
            },
          });
        },
        'Cache update failed for addItem, will refetch:',
        refetch,
      );
    },
  });

  // UPDATE MUTATION
  const [updateItemMutation] = useUpdatePantryItemMutation({
    errorPolicy: 'all',
    onError: error => {
      if (handleVersionConflict(error)) {
        alertService.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      const { message } = handleApolloError(error, {
        operation: 'Update Pantry Item',
      });
      alertService.alert('Error', message);
    },
    optimisticResponse: variables => {
      const currentItem = pantryItems.find(item => item.id === variables.id);

      if (!currentItem) {
        return buildOptimisticMutationResponse(
          'updatePantryItem',
          'PantryItemPayload',
          'pantryItem',
          {
            __typename: 'PantryItem',
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
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Pantry Item',
      });
      alertService.alert('Error', message);
      refetch(); // Restore state on error
    },
    update: (cache, { data }, { variables }) => {
      if (!data?.deletePantryItem?.pantryItem || !pantryId || !variables) {
        return;
      }

      const itemId = variables.id;
      removeFromPantryItemsCache(cache, pantryId, itemId, { evictItem: true });
      cache.modify({
        id: cache.identify({ __typename: 'Pantry', id: pantryId }),
        fields: {
          stats(existingStats: any) {
            if (!existingStats) return existingStats;
            return {
              ...existingStats,
              totalItems: Math.max(0, (existingStats.totalItems || 0) - 1),
            };
          },
        },
      });
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
    onSuccess: (data: CreatePantryItemMutation) =>
      data?.createPantryItem?.pantryItem,
    operationName: 'Add Pantry Item',
  });

  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    const operation = createUpdateOperation({
      mutation: updateItemMutation,
      parentId: () => pantryId,
      itemId,
      onSuccess: (data: UpdatePantryItemMutation) =>
        data?.updatePantryItem?.pantryItem,
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

    const result = await executeMutation(
      () =>
        removeItemMutation({
          variables: { id: itemId },
        }),
      error => {
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

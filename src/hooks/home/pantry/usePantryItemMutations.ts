/**
 * usePantryItemMutations - CRUD mutations for pantry items
 *
 * Single responsibility:
 * - Add, update, remove mutations
 * - Optimistic responses for instant UI
 * - Cache updates for offline-first support
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import type { Unmasked } from '@apollo/client/masking';
import type { IgnoreModifier } from '@apollo/client/cache';
import { alertService } from '#/services/alertService';
import { generateId } from '#/utils/generateId';
import {
  CreatePantryItemDocument,
  UpdatePantryItemDocument,
  DeletePantryItemDocument,
  type CreatePantryItemMutation,
  type UpdatePantryItemMutation,
  type DeletePantryItemMutation,
} from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItem_PantryItemFragmentDoc,
  type UseUpdatePantryItem_PantryItemFragment,
} from '#features/pantry/hooks/mutations/useUpdatePantryItem.generated';
import { useErrorService } from '#/services/errorService';
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
import { incrementNestedCounter } from '#/apollo/utils/cacheUpdaters';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import type { PantryItemInput, PantryItemUpdate } from './types';

interface UsePantryItemMutationsOptions {
  pantryId: string | undefined;
  refetch: () => void;
}

/**
 * Hook for pantry item CRUD operations
 *
 * @example
 * ```tsx
 * const { addItem, updateItem, removeItem } = usePantryItemMutations({
 *   pantryId,
 *   refetch,
 * });
 * ```
 */
export function usePantryItemMutations({
  pantryId,
  refetch,
}: UsePantryItemMutationsOptions) {
  const { handleApolloError } = useErrorService();
  const { createAddOperation, createUpdateOperation } = useCrudOperations();
  const client = useApolloClient();

  // ADD MUTATION
  const [addItemMutation] = useMutation(CreatePantryItemDocument, {
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Add Pantry Item',
      });
      alertService.alert('Error', message);
    },
    optimisticResponse: variables => {
      const tempId = `temp-${generateId()}`;
      const input = variables.input;
      const optimisticPantryItem = {
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
      };
      const optimistic: CreatePantryItemMutation = {
        __typename: 'Mutation',
        createPantryItem: {
          __typename: 'PantryItemPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          pantryItem:
            optimisticPantryItem as CreatePantryItemMutation['createPantryItem']['pantryItem'],
        },
      };
      return optimistic;
    },
    update: (cache, { data }) => {
      const pantryItem = data?.createPantryItem?.pantryItem;
      if (!pantryItem || !pantryId) return;

      executeCacheUpdate(
        () => {
          addToPantryItemsCache(cache, pantryId, pantryItem);
          incrementNestedCounter(
            cache,
            'Pantry',
            pantryId,
            'stats',
            'totalItems',
            1,
          );
        },
        'Cache update failed for addItem, will refetch:',
        refetch,
      );
    },
  });

  // UPDATE MUTATION
  const [updateItemMutation] = useMutation(UpdatePantryItemDocument, {
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
    // Pattern (b) per the migration plan: the operation spread stays masked
    // (no `@unmask` directive), and the callback narrows its OWN return type
    // to `Unmasked<UpdatePantryItemMutation>` so it can return the flat shape.
    optimisticResponse: (
      variables,
      { IGNORE },
    ): IgnoreModifier | Unmasked<UpdatePantryItemMutation> => {
      const currentItem =
        client.cache.readFragment<UseUpdatePantryItem_PantryItemFragment>({
          id: client.cache.identify({
            __typename: 'PantryItem',
            id: variables.id,
          }),
          fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
          fragmentName: 'useUpdatePantryItem_pantryItem',
        });
      if (!currentItem) return IGNORE;

      return {
        __typename: 'Mutation',
        updatePantryItem: {
          __typename: 'PantryItemPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          pantryItem: enhanceWithVersion(
            currentItem,
            // Input types use InputMaybe (T | null | undefined) while fragment
            // types don't accept null — safe cast for optimistic prediction.
            variables.input as Partial<UseUpdatePantryItem_PantryItemFragment>,
          ),
        },
      };
    },
  });

  // REMOVE MUTATION
  const [removeItemMutation] = useMutation(DeletePantryItemDocument, {
    optimisticResponse: (variables): DeletePantryItemMutation => ({
      __typename: 'Mutation',
      deletePantryItem: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: {
          __typename: 'PantryItem',
          id: variables.id,
        } as DeletePantryItemMutation['deletePantryItem']['pantryItem'],
      },
    }),
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
      incrementNestedCounter(
        cache,
        'Pantry',
        pantryId,
        'stats',
        'totalItems',
        -1,
      );
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

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
import { StorageState, StorageType } from '#/graphql/generated/schemaTypes';
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
    optimisticResponse: (variables): Unmasked<CreatePantryItemMutation> => {
      const tempId = `temp-${generateId()}`;
      const input = variables.input;
      type CreatePantryItemPayload =
        Unmasked<CreatePantryItemMutation>['createPantryItem'];
      type CreatePantryItemSuccessShape = Extract<
        CreatePantryItemPayload,
        { __typename: 'CreatePantryItemPayload' }
      >;
      type OptimisticPantryItem = CreatePantryItemSuccessShape['pantryItem'];
      return {
        __typename: 'Mutation',
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: createOptimisticEntity<OptimisticPantryItem>(
            'PantryItem',
            tempId,
            {
              pantryId: pantryId ?? '',
              itemId: input.itemId ?? '',
              itemName: input.item?.name ?? '',
              quantity: input.quantity ?? 1,
              storageState: input.storage?.storageState ?? StorageState.None,
              expiresAt: input.expiresAt ?? null,
              lowStockAlert: false,
              isLowStock: false,
              minQuantity: null,
              lastUsedAt: null,
              netWeight: null,
              remainingNetWeight: null,
              activeBatchCount: 0,
              earliestBatchExpiration: null,
              item: {
                __typename: 'Item',
                id: input.itemId ?? '',
                imageUrl: null,
                images: [],
              },
              unit: input.unit?.unitId
                ? {
                    __typename: 'Unit',
                    id: input.unit.unitId,
                    name: input.unit.unitName ?? '',
                    symbol: '',
                  }
                : null,
              netWeightUnit: null,
              storageLocation: input.storage?.storageLocationName
                ? {
                    __typename: 'StorageLocation',
                    id: `temp-loc-${tempId}`,
                    name: input.storage.storageLocationName,
                    type: StorageType.Custom,
                  }
                : null,
              packageBreakdown: null,
              quantityBreakdown: null,
              pantry: {
                __typename: 'Pantry',
                id: pantryId ?? '',
                stats: {
                  __typename: 'PantryStats',
                  totalItems: 0,
                },
              },
            },
          ),
        },
      };
    },
    update: (cache, { data }) => {
      const payload = data?.createPantryItem;
      if (payload?.__typename !== 'CreatePantryItemPayload' || !pantryId) {
        return;
      }
      const pantryItem = payload.pantryItem;

      executeCacheUpdate(
        () => addToPantryItemsCache(cache, pantryId, pantryItem),
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
            id: variables.input.id,
          }),
          fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
          fragmentName: 'useUpdatePantryItem_pantryItem',
        });
      if (!currentItem) return IGNORE;

      return {
        __typename: 'Mutation',
        updatePantryItem: {
          __typename: 'UpdatePantryItemPayload',
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
  // The DeletePantryItem mutation only selects `{ id }` on `pantryItem`, so the
  // optimistic shape is genuinely complete with `{ __typename, id }` — no cast
  // needed once the callback's return type is `Unmasked<DeletePantryItemMutation>`.
  // The actual edge removal + counter decrement + entity eviction lives in the
  // `update` callback below, which runs in both the optimistic and server phases.
  const [removeItemMutation] = useMutation(DeletePantryItemDocument, {
    optimisticResponse: (variables): Unmasked<DeletePantryItemMutation> => ({
      __typename: 'Mutation',
      deletePantryItem: {
        __typename: 'DeletePantryItemPayload',
        pantryItem: {
          __typename: 'PantryItem',
          id: variables.input.id,
          pantry: {
            __typename: 'Pantry',
            id: pantryId ?? '',
            stats: {
              __typename: 'PantryStats',
              totalItems: 0,
            },
          },
        },
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
      if (
        data?.deletePantryItem?.__typename !== 'DeletePantryItemPayload' ||
        !pantryId ||
        !variables
      ) {
        return;
      }

      const itemId = variables.input.id;
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
    onSuccess: (data: CreatePantryItemMutation) =>
      data?.createPantryItem?.__typename === 'CreatePantryItemPayload'
        ? data.createPantryItem.pantryItem
        : undefined,
    operationName: 'Add Pantry Item',
  });

  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    const operation = createUpdateOperation({
      mutation: updateItemMutation,
      parentId: () => pantryId,
      itemId,
      onSuccess: (data: UpdatePantryItemMutation) =>
        data?.updatePantryItem?.__typename === 'UpdatePantryItemPayload'
          ? data.updatePantryItem.pantryItem
          : undefined,
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
          variables: { input: { id: itemId } },
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

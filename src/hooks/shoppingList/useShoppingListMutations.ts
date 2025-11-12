import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useToggleShoppingListItemPurchasedMutation,
  ShoppingListItemFragmentDoc,
} from '#generated';
import type { ShoppingListItemCoreFragment } from '#/graphql/generated/types';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import {
  createAddToKeyedQueryFieldUpdater,
  createRemoveFromQueryFieldUpdater,
} from '#/apollo/utils';
import { useCrudOperations } from '#/hooks/utils';

// Cache updater utilities for shopping list items
const addToShoppingListItemsCache = createAddToKeyedQueryFieldUpdater<any>(
  'shoppingListItems',
  'shoppingListId',
);

const removeFromShoppingListItemsCache = createRemoveFromQueryFieldUpdater(
  'shoppingListItems',
  'ShoppingListItem',
);

export interface ShoppingListItemInput {
  itemName: string;
  quantity?: number;
  unitName?: string;
  unitId?: string;
  notes?: string;
  category?: string;
}

export interface ShoppingListItemUpdate extends Partial<ShoppingListItemInput> {
  completed?: boolean;
}

interface UseShoppingListMutationsProps {
  listId: string | undefined;
  items: ShoppingListItemCoreFragment[];
  refetch: () => void;
}

/**
 * Hook for shopping list CRUD mutations
 * Handles add, update, remove, and toggle operations with optimistic responses
 */
export function useShoppingListMutations({
  listId,
  items,
  refetch,
}: UseShoppingListMutationsProps) {
  const client = useApolloClient();
  const { handleApolloError } = useErrorHandler();
  const { createAddOperation, createRemoveOperation } = useCrudOperations();

  // Add mutation
  const [addItemMutation] = useAddItemToShoppingListMutation({
    errorPolicy: 'all',
    // Complete optimistic response for offline-first support
    optimisticResponse: (variables: any) => {
      const tempId = `temp-${generateId()}`;
      return {
        __typename: 'Mutation',
        addItemToShoppingList: {
          ...createOptimisticEntity('ShoppingListItem', tempId, {
            // Core fields from mutation input
            itemName: variables.input.itemName,
            quantity: variables.input.quantity ?? 1,
            unitName: variables.input.unitName || null,
            notes: variables.input.notes || null,
            category: variables.input.category || null,
            isPurchased: false,
            // Nested shoppingList object with required fields
            shoppingList: {
              __typename: 'ShoppingList',
              id: listId || '',
              totalItems: null,
              completedItems: null,
              estimatedTotal: null,
            },
            // Nested item object (null if creating from scratch)
            item: variables.input.itemId
              ? {
                  __typename: 'Item',
                  id: variables.input.itemId,
                  name: null,
                  description: null,
                  imageUrl: null,
                  netWeight: null,
                  displayUnit: null,
                  categories: [],
                }
              : null,
            // Nested unit object
            unit: variables.input.unitId
              ? {
                  __typename: 'Unit',
                  id: variables.input.unitId,
                  name: null,
                  symbol: null,
                  type: null,
                  isMetric: null,
                  baseUnitId: null,
                  conversionFactor: null,
                  notes: null,
                  isCommon: null,
                  sortOrder: null,
                  createdAt: null,
                  updatedAt: null,
                }
              : null,
            // Price-related fields (null for new items)
            estimatedPrice: null,
            budgetPrice: null,
            lastKnownPrice: null,
            lowestPrice: null,
            highestPrice: null,
            priceLastUpdated: null,
            // Purchase-related fields (null for unpurchased items)
            purchasedQuantity: null,
            purchasedPrice: null,
            purchaseDate: null,
            purchasedBy: null,
            purchases: [],
            // Store/location fields
            aisle: null,
            storeSection: null,
            // History fields
            previouslyPurchased: false,
            lastPurchaseDate: null,
            purchaseCount: 0,
            // Metadata fields
            priority: null,
            sortOrder: null,
            isAutoAdded: false,
            autoAddReason: null,
            isFromMealPlan: false,
            mealPlanReference: null,
            createdAt: null,
            deletedAt: null,
            addedBy: null,
          }),
          __typename: 'ShoppingListItem',
        } as any,
      };
    },
    update(cache, { data }) {
      if (!data?.addItemToShoppingList || !listId) return;

      try {
        // Add to cache using generic utility
        addToShoppingListItemsCache(cache, data.addItemToShoppingList, listId);
      } catch (error) {
        console.warn('Cache update failed for addItem, will refetch:', error);
        // Fallback: refetch if cache update fails
        refetch();
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Add Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // Update mutation
  const [updateItemMutation] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // Remove mutation
  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    optimisticResponse: (variables) => {
      // Find the item being removed to return in optimistic response
      const item = items.find(i => i.id === variables.id);
      if (!item) {
        // Fallback - return minimal entity
        return {
          __typename: 'Mutation',
          removeItemFromShoppingList: {
            __typename: 'ShoppingListItem',
            id: variables.id,
          } as any,
        };
      }
      // Return the full item being removed
      return {
        __typename: 'Mutation',
        removeItemFromShoppingList: item as any,
      };
    },
    update(cache, { data }, { variables }) {
      if (!data?.removeItemFromShoppingList || !listId || !variables) return;

      try {
        const itemId = variables.id;

        // Save to optimistic persistence before removing
        optimisticDataPersistence.save('ShoppingListItem', itemId, '__deleted', true);

        // Remove from cache using generic utility (handles filter + evict + gc)
        removeFromShoppingListItemsCache(cache, itemId, { evictItem: true });
      } catch (error) {
        console.warn(
          'Cache update failed for removeItem, will refetch:',
          error,
        );
        // Fallback: refetch if cache update fails
        refetch();
      }
    },
    onCompleted: (data) => {
      // Clear optimistic data after successful sync
      if (data?.removeItemFromShoppingList) {
        optimisticDataPersistence.clear('ShoppingListItem', data.removeItemFromShoppingList.id, '__deleted');
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // Toggle purchased mutation
  const [togglePurchasedMutation] = useToggleShoppingListItemPurchasedMutation({
    errorPolicy: 'all',
    optimisticResponse: (variables) => {
      const cacheId = client.cache.identify({
        __typename: 'ShoppingListItem',
        id: variables.id,
      });

      const fullItem = cacheId
        ? client.readFragment<any>({
            id: cacheId,
            fragment: ShoppingListItemFragmentDoc,
            fragmentName: 'ShoppingListItemFragment',
          })
        : null;

      if (fullItem) {
        return {
          __typename: 'Mutation',
          toggleShoppingListItemPurchased: {
            ...fullItem,
            __typename: 'ShoppingListItem',
            isPurchased: variables.purchased,
            updatedAt: new Date().toISOString(),
          },
        };
      }

      // Fallback to core data if fragment is missing in cache
      const currentItem = items.find(item => item.id === variables.id);

      if (currentItem) {
        return {
          __typename: 'Mutation',
          toggleShoppingListItemPurchased: {
            __typename: 'ShoppingListItem',
            id: currentItem.id,
            itemName: currentItem.itemName,
            quantity: currentItem.quantity,
            isPurchased: variables.purchased,
            version: currentItem.version,
            updatedAt: new Date().toISOString(),
            category: currentItem.category,
            notes: currentItem.notes,
            unitName: currentItem.unitName,
            unit: currentItem.unit,
          } as any,
        };
      }

      return {
        __typename: 'Mutation',
        toggleShoppingListItemPurchased: {
          __typename: 'ShoppingListItem',
          id: variables.id,
          isPurchased: variables.purchased,
          updatedAt: new Date().toISOString(),
        } as any,
      };
    },
    onCompleted: (data) => {
      // Clear optimistic data after successful sync
      if (data?.toggleShoppingListItemPurchased) {
        optimisticDataPersistence.clear('ShoppingListItem', data.toggleShoppingListItemPurchased.id, 'isPurchased');
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Toggle Item Purchased',
      });
      Alert.alert('Error', message);
    },
  });

  // Simplified add item using CRUD utilities
  const addItem = createAddOperation({
    mutation: addItemMutation,
    parentId: listId,
    transformInput: (input: ShoppingListItemInput) => ({
      shoppingListId: listId,
      itemName: input.itemName,
      quantity: input.quantity ?? 1,
      ...(input.unitName && { unitName: input.unitName }),
      ...(input.unitId && { unitId: input.unitId }),
      ...(input.notes && { notes: input.notes }),
      ...(input.category && { category: input.category }),
    }),
    onSuccess: (data: any) => data?.addItemToShoppingList,
    operationName: 'Add Shopping List Item',
  });

  // Simplified update item
  const updateItem = useCallback(async (
    itemId: string,
    updates: ShoppingListItemUpdate,
  ) => {
    if (!listId) return false;

    try {
      // Read FRESH data from cache - use Full fragment (guaranteed to be cached)
      const fullItem = client.readFragment<any>({
        id: client.cache.identify({
          __typename: 'ShoppingListItem',
          id: itemId,
        }),
        fragment: ShoppingListItemFragmentDoc,
        fragmentName: 'ShoppingListItemFragment',
      });

      if (!fullItem) {
        console.warn(
          'Item not in cache, cannot update optimistically:',
          itemId,
        );
        // Still attempt the mutation without optimistic response
        const result = await updateItemMutation({
          variables: {
            id: itemId,
            input: updates,
          },
        });
        return result.data?.updateShoppingListItem ?? false;
      }

      // Extract core fields for optimistic response
      const coreFields: ShoppingListItemCoreFragment = {
        __typename: 'ShoppingListItem',
        id: fullItem.id,
        itemName: fullItem.itemName,
        quantity: fullItem.quantity,
        quantityInput: fullItem.quantityInput,
        displayFormat: fullItem.displayFormat,
        isPurchased: fullItem.isPurchased,
        version: fullItem.version,
        updatedAt: fullItem.updatedAt,
        category: fullItem.category,
        notes: fullItem.notes,
        unitName: fullItem.unitName,
        unit: fullItem.unit
          ? {
              __typename: 'Unit',
              id: fullItem.unit.id,
              name: fullItem.unit.name,
              symbol: fullItem.unit.symbol,
              displayAsFraction: fullItem.unit.displayAsFraction,
              minPrecision: fullItem.unit.minPrecision,
              autoConvertThreshold: fullItem.unit.autoConvertThreshold,
            }
          : null,
      };

      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: {
            ...updates,
            // Include version for server-side concurrency control
            version: coreFields.version,
          },
        },
        optimisticResponse: {
          __typename: 'Mutation',
          updateShoppingListItem: {
            ...coreFields,
            ...updates,
            updatedAt: new Date().toISOString(),
          } as any,
        },
      });

      return result.data?.updateShoppingListItem ?? false;
    } catch (error: any) {
      // Handle version conflict errors
      if (handleVersionConflict(error)) {
        Alert.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return false;
      }

      console.error('Update shopping list item error:', error);
      return false;
    }
  }, [client, listId, updateItemMutation, refetch]);

  // Simplified remove item using CRUD utilities
  const removeItem = useCallback(async (itemId: string) => {
    const operation = createRemoveOperation({
      mutation: removeItemMutation,
      parentId: listId,
      itemId,
      operationName: 'Delete Shopping List Item',
    });
    return operation();
  }, [createRemoveOperation, removeItemMutation, listId]);

  // Toggle item purchased status
  const toggleItem = useCallback(async (itemId: string) => {
    if (!listId) return false;

    try {
      // Find item to get current isPurchased state and version
      const currentItem = items.find(item => item.id === itemId);

      if (!currentItem) {
        console.warn('Item not found:', itemId);
        return false;
      }

      const newStatus = !currentItem.isPurchased;

      const result = await togglePurchasedMutation({
        variables: {
          id: itemId,
          purchased: newStatus,
          version: currentItem.version,
        },
      });

      return result.data?.toggleShoppingListItemPurchased ?? false;
    } catch (error) {
      console.error('Toggle shopping list item purchased error:', error);
      return false;
    }
  }, [listId, items, togglePurchasedMutation]);

  return {
    addItem,
    updateItem,
    removeItem,
    toggleItem,
  };
}

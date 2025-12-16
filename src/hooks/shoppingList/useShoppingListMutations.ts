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
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils';
import { useCrudOperations } from '#/hooks/utils';

// Cache updater utilities for shopping list items connection
// Uses parent connection pattern for ShoppingList.itemsConnection
const addToShoppingListItemsCache = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

const removeFromShoppingListItemsCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
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
            // NEW: Nested purchaseInfo object
            purchaseInfo: {
              __typename: 'PurchaseInfo',
              isPurchased: false,
              purchasedQuantity: null,
              purchasedPrice: null,
              purchaseDate: null,
              purchasedBy: null,
            },
            // NEW: Nested priceEstimate object
            priceEstimate: {
              __typename: 'PriceEstimate',
              estimated: null,
              budget: null,
              lastKnown: null,
              lowest: null,
              highest: null,
              lastUpdated: null,
            },
            // NEW: Nested storeInfo object
            storeInfo: {
              __typename: 'StoreInfo',
              aisle: null,
              storeSection: null,
              preferredStore: null,
            },
            // NEW: Nested purchaseHistory object
            purchaseHistory: {
              __typename: 'PurchaseHistory',
              previouslyPurchased: false,
              lastPurchaseDate: null,
              purchaseCount: 0,
            },
            // NEW: Nested source object
            source: {
              __typename: 'Source',
              isAutoAdded: false,
              autoAddReason: null,
              isFromMealPlan: false,
              mealPlan: null,
            },
            // Metadata fields
            priority: null,
            sortOrder: null,
            createdAt: null,
            deletedAt: null,
            addedBy: null,
            purchasesConnection: {
              __typename: 'PurchaseConnection',
              edges: [],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: null,
              },
              totalCount: 0,
            },
          }),
          __typename: 'ShoppingListItem',
        } as any,
      };
    },
    update(cache, { data }) {
      if (!data?.addItemToShoppingList || !listId) return;

      try {
        // Add to cache using generic utility
        // Parent connection pattern: (cache, parentId, newItem)
        addToShoppingListItemsCache(cache, listId, data.addItemToShoppingList);
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
    optimisticResponse: variables => {
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
        optimisticDataPersistence.save(
          'ShoppingListItem',
          itemId,
          '__deleted',
          true,
        );

        // Remove from cache using generic utility (handles filter + evict + gc)
        // Parent connection pattern: (cache, parentId, itemId, options)
        removeFromShoppingListItemsCache(cache, listId, itemId, {
          evictItem: true,
        });
      } catch (error) {
        console.warn(
          'Cache update failed for removeItem, will refetch:',
          error,
        );
        // Fallback: refetch if cache update fails
        refetch();
      }
    },
    onCompleted: data => {
      // Clear optimistic data after successful sync
      if (data?.removeItemFromShoppingList) {
        optimisticDataPersistence.clear(
          'ShoppingListItem',
          data.removeItemFromShoppingList.id,
          '__deleted',
        );
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
  // Uses cache.modify() for instant UI updates (Pattern 5 from apollo-client-patterns.md)
  // This avoids "Missing field" warnings from partial optimistic responses
  const [togglePurchasedMutation] = useToggleShoppingListItemPurchasedMutation({
    errorPolicy: 'all',
    // No optimisticResponse - cache.modify in update handles instant UI
    update(cache, { data }, { variables }) {
      if (!data?.toggleShoppingListItemPurchased || !variables) return;

      const itemId = variables.id;
      const newStatus = variables.purchased;

      // Directly modify the cached item's fields for instant UI feedback
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fields: {
          purchaseInfo(existing = {}) {
            return {
              ...existing,
              isPurchased: newStatus,
            };
          },
          updatedAt() {
            return new Date().toISOString();
          },
        },
      });
    },
    onCompleted: data => {
      // Clear optimistic data after successful sync
      if (data?.toggleShoppingListItemPurchased) {
        optimisticDataPersistence.clear(
          'ShoppingListItem',
          data.toggleShoppingListItemPurchased.id,
          'isPurchased',
        );
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
    parentId: () => listId,
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
  const updateItem = useCallback(
    async (itemId: string, updates: ShoppingListItemUpdate) => {
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
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: fullItem.purchaseInfo?.isPurchased ?? false,
          },
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
    },
    [client, listId, updateItemMutation, refetch],
  );

  // Simplified remove item using CRUD utilities
  const removeItem = useCallback(
    async (itemId: string) => {
      const operation = createRemoveOperation({
        mutation: removeItemMutation,
        parentId: listId,
        itemId,
        operationName: 'Delete Shopping List Item',
      });
      return operation();
    },
    [createRemoveOperation, removeItemMutation, listId],
  );

  // Toggle item purchased status
  // Version parameter omitted for idempotent behavior - prevents conflicts on rapid toggles
  // See: docs/api-improvements-version-conflicts.md
  const toggleItem = useCallback(
    async (itemId: string) => {
      if (!listId) return false;

      try {
        // Find item to get current isPurchased state
        const currentItem = items.find(item => item.id === itemId);

        if (!currentItem) {
          console.warn('Item not found:', itemId);
          return false;
        }

        const newStatus = !currentItem.purchaseInfo?.isPurchased;

        const result = await togglePurchasedMutation({
          variables: {
            id: itemId,
            purchased: newStatus,
            // No version parameter - idempotent operation
          },
        });

        return result.data?.toggleShoppingListItemPurchased ?? false;
      } catch (error) {
        console.error('Toggle shopping list item purchased error:', error);
        return false;
      }
    },
    [listId, items, togglePurchasedMutation],
  );

  return {
    addItem,
    updateItem,
    removeItem,
    toggleItem,
  };
}

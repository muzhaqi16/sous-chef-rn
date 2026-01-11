import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useToggleShoppingListItemPurchasedMutation,
  DisplayFormat,
  ShoppingListItemDisplayFragmentDoc,
} from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  addToUnpurchasedItems,
  removeFromUnpurchasedItems,
  addToPurchasedItems,
  removeFromPurchasedItems,
} from '#/apollo/utils';
import { useCrudOperations } from '#/hooks/utils';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

// Helper to detect if error is network-related (skip alerts, let queue handle retry)
const isNetworkError = (error: any): boolean => {
  const message = (error?.message || error?.networkError?.message || '').toLowerCase();
  const networkPatterns = [
    'network request failed',
    'network error',
    'connection refused',
    'timeout',
    'enotfound',
    'econnrefused',
    'econnreset',
    'unable to reach',
    'no internet',
    'offline',
  ];
  return networkPatterns.some(pattern => message.includes(pattern)) || !!error?.networkError;
};

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

/**
 * useShoppingListItemMutations - CRUD mutations for shopping list items
 *
 * Single responsibility:
 * - Add, update, remove, toggle mutations
 * - Optimistic responses for instant UI
 * - Cache updates for offline-first support
 *
 * This hook is consumed by useShoppingListManagement for data orchestration.
 */
export function useShoppingListItemMutations(
  listId: string | null | undefined,
  items: ShoppingListItemDisplayFragment[],
  refetch: () => Promise<any>,
) {
  const { handleApolloError } = useErrorHandler();

  // CRUD operations utilities
  const { createAddOperation, createRemoveOperation } = useCrudOperations();

  // === ADD MUTATION ===
  const [addItemMutation] = useAddItemToShoppingListMutation({
    errorPolicy: 'all',
    optimisticResponse: (variables: any) => {
      const tempId = `temp-${generateId()}`;
      return {
        __typename: 'Mutation',
        addItemToShoppingList: {
          ...createOptimisticEntity('ShoppingListItem', tempId, {
            itemName: variables.input.itemName,
            quantity: variables.input.quantity ?? 1,
            quantityInput: variables.input.quantityInput || null,
            displayFormat: DisplayFormat.Auto,
            unitName: variables.input.unitName || null,
            notes: variables.input.notes || null,
            category: variables.input.category || null,
            shoppingList: {
              __typename: 'ShoppingList',
              id: listId || '',
              totalItems: null,
              completedItems: null,
              estimatedTotal: null,
            },
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
            purchaseInfo: {
              __typename: 'PurchaseInfo',
              isPurchased: false,
              purchasedQuantity: null,
              purchasedPrice: null,
              purchaseDate: null,
              purchasedBy: null,
            },
            priceEstimate: {
              __typename: 'PriceEstimate',
              estimated: null,
              budget: null,
              lastKnown: null,
              lowest: null,
              highest: null,
              lastUpdated: null,
            },
            storeInfo: {
              __typename: 'StoreInfo',
              aisle: null,
              storeSection: null,
              preferredStore: null,
            },
            purchaseHistory: {
              __typename: 'PurchaseHistory',
              previouslyPurchased: false,
              lastPurchaseDate: null,
              purchaseCount: 0,
            },
            source: {
              __typename: 'Source',
              isAutoAdded: false,
              autoAddReason: null,
              isFromMealPlan: false,
              mealPlan: null,
            },
            priority: null,
            sortOrder: null,
            createdAt: null,
            deletedAt: null,
            addedBy: null,
            purchasesConnection: {
              __typename: 'PurchaseConnection',
              totalCount: 0,
              edges: [],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: null,
              },
            },
          }),
          __typename: 'ShoppingListItem',
        } as any,
      };
    },
    update(cache, { data }) {
      if (!data?.addItemToShoppingList || !listId) return;

      try {
        addToShoppingListItemsCache(
          cache,
          listId,
          data.addItemToShoppingList,
        );
      } catch (error) {
        console.warn('Cache update failed for addItem, will refetch:', error);
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

  // === UPDATE MUTATION ===
  // Apollo auto-normalizes the server response by __typename + id
  // No onCompleted cleanup needed - cache persistence handles this automatically
  const [updateItemMutation] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // === REMOVE MUTATION ===
  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    optimisticResponse: variables => {
      const item = items.find(i => i.id === variables.id);
      if (!item) {
        return {
          __typename: 'Mutation',
          removeItemFromShoppingList: {
            __typename: 'ShoppingListItem',
            id: variables.id,
          } as any,
        };
      }
      return {
        __typename: 'Mutation',
        removeItemFromShoppingList: item as any,
      };
    },
    update(cache, { data }, { variables }) {
      if (!data?.removeItemFromShoppingList || !listId || !variables) return;

      try {
        const itemId = variables.id;
        removeFromShoppingListItemsCache(cache, listId, itemId, { evictItem: true });
      } catch (error) {
        console.warn('Cache update failed for removeItem, will refetch:', error);
        refetch();
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // === TOGGLE MUTATION ===
  // Uses optimisticResponse for instant UI feedback when toggling purchase status
  const [togglePurchasedMutation] = useToggleShoppingListItemPurchasedMutation({
    errorPolicy: 'all',
    // Optimistic response ensures update() runs immediately (not after network response)
    optimisticResponse: variables => {
      const item = items.find(i => i.id === variables.id);
      return {
        __typename: 'Mutation',
        toggleShoppingListItemPurchased: {
          __typename: 'ShoppingListItem',
          id: variables.id,
          itemName: item?.itemName ?? null,
          quantity: item?.quantity ?? null,
          quantityInput: item?.quantityInput ?? null,
          normalizedQuantity: null,
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: variables.purchased,
            purchasedQuantity: null,
            purchasedPrice: null,
            purchaseDate: variables.purchased ? new Date().toISOString() : null,
          },
          updatedAt: new Date().toISOString(),
          version: item?.version ?? 0,
          category: item?.category ?? null,
          unitName: item?.unitName ?? null,
          unit: item?.unit ?? null,
        },
      };
    },
    update(cache, _result, { variables }) {
      if (!variables || !listId) return;

      const itemId = variables.id;
      const newStatus = variables.purchased; // true = marking purchased, false = marking unpurchased

      // 1. Update the item's purchaseInfo field directly
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fields: {
          purchaseInfo(existingPurchaseInfo = {}) {
            return {
              ...existingPurchaseInfo,
              isPurchased: newStatus,
            };
          },
          updatedAt() {
            return new Date().toISOString();
          },
        },
      });

      // 2. Move item between connections using cache.modify on ShoppingList entity
      // This is the PREFERRED pattern per docs/apollo-client-patterns.md
      // With keyArgs: ['filters'], Apollo stores separate connection variants
      // The itemsConnection modifier is called for EACH variant (unpurchased/purchased)
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingList', id: listId }),
        fields: {
          itemsConnection(existing: any, { readField, storeFieldName, toReference }) {
            // Determine which connection variant we're modifying based on storeFieldName
            // storeFieldName contains the serialized keyArgs, e.g., 'itemsConnection({"filters":{"isPurchased":false}})'
            const isUnpurchasedConnection = storeFieldName.includes('isPurchased":false');
            const isPurchasedConnection = storeFieldName.includes('isPurchased":true');

            if (!existing?.edges) return existing;

            if (newStatus) {
              // Marking as purchased: remove from unpurchased, add to purchased
              if (isUnpurchasedConnection) {
                // Filter out the item AND any broken edges with missing node IDs
                const filteredEdges = existing.edges.filter((edge: any) => {
                  const nodeId = readField('id', edge?.node);
                  return nodeId !== undefined && nodeId !== null && nodeId !== itemId;
                });
                return {
                  ...existing,
                  edges: filteredEdges,
                  totalCount: Math.max(0, (existing.totalCount || 0) - 1),
                };
              }
              if (isPurchasedConnection) {
                // Check for duplicates, handling undefined node IDs
                const alreadyExists = existing.edges.some((edge: any) => {
                  const nodeId = readField('id', edge?.node);
                  return nodeId === itemId;
                });
                if (alreadyExists) return existing;
                return {
                  ...existing,
                  edges: [
                    {
                      __typename: 'ShoppingListItemEdge',
                      cursor: itemId,
                      node: toReference({ __typename: 'ShoppingListItem', id: itemId }),
                    },
                    ...existing.edges,
                  ],
                  totalCount: (existing.totalCount || 0) + 1,
                };
              }
            } else {
              // Marking as unpurchased: remove from purchased, add to unpurchased
              if (isPurchasedConnection) {
                // Filter out the item AND any broken edges with missing node IDs
                const filteredEdges = existing.edges.filter((edge: any) => {
                  const nodeId = readField('id', edge?.node);
                  return nodeId !== undefined && nodeId !== null && nodeId !== itemId;
                });
                return {
                  ...existing,
                  edges: filteredEdges,
                  totalCount: Math.max(0, (existing.totalCount || 0) - 1),
                };
              }
              if (isUnpurchasedConnection) {
                // Check for duplicates, handling undefined node IDs
                const alreadyExists = existing.edges.some((edge: any) => {
                  const nodeId = readField('id', edge?.node);
                  return nodeId === itemId;
                });
                if (alreadyExists) return existing;
                return {
                  ...existing,
                  edges: [
                    {
                      __typename: 'ShoppingListItemEdge',
                      cursor: itemId,
                      node: toReference({ __typename: 'ShoppingListItem', id: itemId }),
                    },
                    ...existing.edges,
                  ],
                  totalCount: (existing.totalCount || 0) + 1,
                };
              }
            }

            return existing;
          },
        },
      });

      // 2b. Also update aliased fields used by GetShoppingListItemsPaginatedQuery
      // This query uses aliases: unpurchasedItems/purchasedItems instead of itemsConnection
      // Apollo caches aliased fields separately, so we must update them explicitly

      // Read full item data from cache to ensure complete item info when adding to new connection
      // This prevents empty items from appearing due to incomplete cache references
      const fullItem = cache.readFragment<ShoppingListItemDisplayFragment>({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fragment: ShoppingListItemDisplayFragmentDoc,
        fragmentName: 'ShoppingListItemDisplayFragment',
      });

      if (newStatus) {
        // Moving to purchased: remove from unpurchased, add to purchased
        removeFromUnpurchasedItems(cache, listId, itemId);
        addToPurchasedItems(cache, listId, fullItem || { id: itemId });
      } else {
        // Moving to unpurchased: remove from purchased, add to unpurchased
        removeFromPurchasedItems(cache, listId, itemId);
        addToUnpurchasedItems(cache, listId, fullItem || { id: itemId });
      }

      // 3. Persist optimistic isPurchased to survive app restarts while offline
      optimisticDataPersistence.save(
        'ShoppingListItem',
        itemId,
        'isPurchased',
        newStatus,
      );
    },
    onCompleted: data => {
      // Clear persisted optimistic data on successful server sync
      if (data?.toggleShoppingListItemPurchased?.id) {
        optimisticDataPersistence.clear(
          'ShoppingListItem',
          data.toggleShoppingListItemPurchased.id,
          'isPurchased',
        );
      }
    },
    onError: error => {
      // For network errors, don't show alert or refetch - queue will handle retry
      // This keeps the optimistic UI intact while offline
      if (isNetworkError(error)) {
        console.log('Toggle purchase queued for retry (network error)');
        return;
      }

      // For server/validation errors, show alert and refetch to restore correct state
      const { message } = handleApolloError(error, {
        operation: 'Toggle Item Purchased',
      });
      Alert.alert('Error', message);
      refetch();
    },
  });

  // === WRAPPED OPERATIONS ===

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

  // Simplified updateItem - uses items array instead of cache read
  // Apollo auto-normalizes the server response, so we just need basic optimistic response
  const updateItem = async (itemId: string, updates: ShoppingListItemUpdate) => {
    if (!listId) return false;

    try {
      // Use items array (already in memory) instead of cache read
      const item = items.find(i => i.id === itemId);

      if (!item) {
        console.warn('Item not found, cannot update:', itemId);
        return false;
      }

      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: { ...updates, version: item.version },
        },
        // Simple optimistic response - Apollo merges by __typename + id
        // Only include fields from ShoppingListItemDisplayFragment
        optimisticResponse: {
          __typename: 'Mutation',
          updateShoppingListItem: {
            __typename: 'ShoppingListItem',
            id: item.id,
            itemName: updates.itemName ?? item.itemName,
            quantity: updates.quantity ?? item.quantity,
            quantityInput: item.quantityInput,
            purchaseInfo: item.purchaseInfo,
            version: item.version,
            updatedAt: new Date().toISOString(),
            category: updates.category ?? item.category,
            unitName: updates.unitName ?? item.unitName,
            unit: item.unit,
            sortOrder: item.sortOrder,
            item: item.item,
          } as any,
        },
      });

      return result.data?.updateShoppingListItem ?? false;
    } catch (error: any) {
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
  };

  const removeItem = async (itemId: string) => {
    const operation = createRemoveOperation({
      mutation: removeItemMutation,
      parentId: listId,
      itemId,
      operationName: 'Delete Shopping List Item',
    });
    return operation();
  };

  // Simplified toggleItem - uses items array instead of cache read
  const toggleItem = useCallback(
    async (itemId: string) => {
      if (!listId) return false;

      try {
        const item = items.find(i => i.id === itemId);
        if (!item) return false;

        const newStatus = !item.purchaseInfo?.isPurchased;

        const result = await togglePurchasedMutation({
          variables: { id: itemId, purchased: newStatus },
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

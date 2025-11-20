import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  useGetShoppingListItemsQuery,
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useToggleShoppingListItemPurchasedMutation,
  ShoppingListItemFragmentDoc,
  DisplayFormat,
} from '#generated';
import type { ShoppingListItemCoreFragment } from '#/graphql/generated/types';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { useOfflineAwareFetchPolicy, OFFLINE_FETCH_POLICIES } from '#/apollo/policies/offlineFetchPolicies';
import {
  createAddToKeyedQueryFieldUpdater,
  createRemoveFromQueryFieldUpdater,
} from '#/apollo/utils';
import { shoppingListItemSearch } from '#/utils/searchUtils';
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

/**
 * Vanilla Apollo shopping list management hook
 * Uses optimistic responses for instant UI updates
 * No refetchQueries, no custom caches - Apollo handles everything
 */
export function useShoppingListManagement(listId: string | undefined) {
  const client = useApolloClient();
  const { isLoggedOut } = useAuth();
  const { handleApolloError } = useErrorHandler();
  const shouldSkip = !listId || isLoggedOut;

  // Dynamic fetch policy based on network status
  // Online: cache-and-network (fresh data + instant UI)
  // Offline: cache-only (stops network thrashing and loading flickers)
  const fetchPolicy = useOfflineAwareFetchPolicy(
    OFFLINE_FETCH_POLICIES.LIST.online,   // 'cache-and-network'
    OFFLINE_FETCH_POLICIES.LIST.offline   // 'cache-only'
  );

  // Watch cache for updates from mutations and subscriptions
  const {
    data,
    loading,
    error,
    refetch,
  } = useGetShoppingListItemsQuery({
    variables: {
      shoppingListId: listId ?? '',
    },
    skip: shouldSkip,
    fetchPolicy,
    nextFetchPolicy: 'cache-first', // After first fetch, use cache-first to prevent refetch on tab switch
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all', // Return both data and errors for better debugging
  });

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // This eliminates duplicate subscription code and provides consistent behavior
  // across all subscriptions (deduplication, error handling, logging)

  // PERFORMANCE FIX: Clear items immediately when list changes to prevent showing stale data
  // Track previous listId to detect list changes
  const prevListIdRef = useRef<string | null | undefined>(null);
  const [isListChanging, setIsListChanging] = useState(false);

  useEffect(() => {
    if (prevListIdRef.current !== null && prevListIdRef.current !== listId) {
      // List changed - temporarily show empty state until new data arrives
      setIsListChanging(true);
    }
    prevListIdRef.current = listId;
  }, [listId]);

  useEffect(() => {
    // Reset changing flag when new data arrives
    if (isListChanging && data?.shoppingListItems) {
      setIsListChanging(false);
    }
  }, [data?.shoppingListItems, isListChanging]);

  const items = useMemo(
    () => (isListChanging ? [] : data?.shoppingListItems || []),
    [data?.shoppingListItems, isListChanging],
  );

  // Search functionality - using reusable search utility
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(items, shoppingListItemSearch);

  // Simple stats calculation
  const stats = useMemo(() => {
    const total = items.length;
    // Filter out null items (defensive against cache corruption)
    const completed = items.filter(item => item?.isPurchased).length;
    const pending = total - completed;

    return {
      total,
      completed,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [items]);

  // CRUD operations utilities
  const { createAddOperation, createRemoveOperation } = useCrudOperations();

  // Pagination helpers (shoppingListItems returns full list; no pagination)
  const loadMore = useCallback(async () => {
    return;
  }, []);
  const hasMore = false;

  // Mutations - Apollo handles cache updates automatically
  const [addItemMutation] = useAddItemToShoppingListMutation({
    errorPolicy: 'all',
    // Complete optimistic response for offline-first support
    // Uses 'as any' cast (like PantryItem) to bypass TypeScript validation
    // Provides all required fragment fields with null for unknowns
    optimisticResponse: (variables: any) => {
      const tempId = `temp-${generateId()}`;
      return {
        __typename: 'Mutation',
        addItemToShoppingList: {
          ...createOptimisticEntity('ShoppingListItem', tempId, {
            // Core fields from mutation input
            itemName: variables.input.itemName,
            quantity: variables.input.quantity ?? 1,
            quantityInput: variables.input.quantityInput || null,
            displayFormat: DisplayFormat.Auto,
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
        } as any, // Cast to any (like PantryItem) to bypass TypeScript validation
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

  const [updateItemMutation] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    // No optimisticResponse here - will be passed at call site with fresh cache data
    // This avoids stale closure issues as per Apollo best practices
    onCompleted: (data) => {
      // Clear all optimistic data for this item after successful sync
      // This ensures offline edits are cleared once synced with server
      if (data?.updateShoppingListItem) {
        const itemId = data.updateShoppingListItem.id;
        // Clear common fields that might be updated
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'quantity');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'quantityInput');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'itemName');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'notes');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'category');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'unitName');
        optimisticDataPersistence.clear('ShoppingListItem', itemId, 'unitId');
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

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
    // PERFORMANCE: Removed redundant update function
    // The comprehensive optimisticResponse (lines 361-418) provides instant UI feedback
    // Apollo's automatic normalization merges the server response into the cache
    // No manual cache.modify needed - this was causing unnecessary complexity
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
  const updateItem = async (
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
      // Using Core fragment prevents cache corruption from __ref fields
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

      // Persist optimistic updates before mutation
      // This ensures changes survive app restart if offline
      Object.keys(updates).forEach(field => {
        const value = updates[field as keyof ShoppingListItemUpdate];
        if (value !== undefined) {
          optimisticDataPersistence.save('ShoppingListItem', itemId, field, value);
        }
      });

      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: {
            ...updates,
            // Include version for server-side concurrency control
            version: coreFields.version,
          },
        },
        // Pass optimistic response with core fields only
        // This avoids cache corruption from __ref fields in nested objects
        // "Missing field" warnings are cosmetic and don't affect functionality
        optimisticResponse: {
          __typename: 'Mutation',
          updateShoppingListItem: {
            ...coreFields,
            ...updates,
            updatedAt: new Date().toISOString(),
          } as any, // Core fragment is sufficient for optimistic response
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
  };

  // Simplified remove item using CRUD utilities
  const removeItem = async (itemId: string) => {
    const operation = createRemoveOperation({
      mutation: removeItemMutation,
      parentId: listId,
      itemId,
      operationName: 'Delete Shopping List Item',
    });
    return operation();
  };

  // Toggle item purchased status
  const toggleItem = async (itemId: string) => {
    if (!listId) return false;

    try {
      // Find item to get current isPurchased state and version
      const currentItem = items.find(item => item.id === itemId);

      if (!currentItem) {
        console.warn('Item not found:', itemId);
        return false;
      }

      const newStatus = !currentItem.isPurchased;

      // Use specialized toggle mutation with version for optimistic concurrency
      // Cache update is handled by cache.modify in the mutation's update function
      const result = await togglePurchasedMutation({
        variables: {
          id: itemId,
          purchased: newStatus,
          version: currentItem.version,
        },
        // No optimisticResponse - cache.modify in update function handles instant UI
      });

      return result.data?.toggleShoppingListItemPurchased ?? false;
    } catch (error) {
      console.error('Toggle shopping list item purchased error:', error);
      return false;
    }
  };

  return {
    // Data
    items: filteredItems,
    allItems: items,
    loading: loading || isListChanging, // Show loading during list transition
    error,
    stats,

    // Pagination
    loadMore,
    hasMore,
    isLoadingMore: loading && items.length > 0,

    // Search
    searchQuery,
    setSearchQuery,

    // Actions
    addItem,
    updateItem,
    removeItem,
    toggleItem,
    refetch,

    // Helper functions
    getItemById: (itemId: string) => items.find(item => item.id === itemId),
    getCompletedItems: () => items.filter(item => item.isPurchased),
    getPendingItems: () => items.filter(item => !item.isPurchased),
    getItemsByCategory: (category: string) =>
      items.filter(item => item.category === category),
  };
}

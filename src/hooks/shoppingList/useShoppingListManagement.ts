import { useMemo } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  useGetShoppingListItemsQuery,
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useToggleShoppingListItemPurchasedMutation,
  ShoppingListItemFragmentDoc,
} from '#generated';
import type { ShoppingListItemCoreFragment } from '#/graphql/generated/types';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';
import { useErrorHandler } from '#/utils/errorHandling';
import { usePreservedArrayData } from '#/hooks/apollo';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';

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

  // Watch cache for updates from mutations and subscriptions
  // Use cache-and-network for fresh data while maintaining offline support
  const queryResult = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId ?? '' },
    skip: shouldSkip,
    // cache-and-network: Returns cached data immediately (instant UI),
    // then always fetches fresh data from network when online.
    // Apollo automatically falls back to cache-only when offline.
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all', // Return both data and errors for better debugging
  });

  const { data, loading, error, refetch } = queryResult;

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // This eliminates duplicate subscription code and provides consistent behavior
  // across all subscriptions (deduplication, error handling, logging)

  // Preserve shopping list items even when query fails to prevent cascade failures
  const items = usePreservedArrayData(data?.shoppingListItems);

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(items, (item, q) => {
    const searchTerm = q.toLowerCase();
    return !!(
      item?.itemName?.toLowerCase().includes(searchTerm) ||
      item?.category?.toLowerCase().includes(searchTerm)
    );
  });

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
        } as any, // Cast to any (like PantryItem) to bypass TypeScript validation
      };
    },
    update(cache, { data }) {
      if (!data?.addItemToShoppingList || !listId) return;

      try {
        // Modify the shoppingListItems field in the cache
        cache.modify({
          fields: {
            shoppingListItems(existingItems = [], { readField, toReference }) {
              const newItemRef = toReference(data.addItemToShoppingList);

              // Check if item already exists (avoid duplicates)
              const exists = existingItems.some(
                (itemRef: any) =>
                  readField('id', itemRef) === data.addItemToShoppingList.id,
              );

              if (exists) {
                return existingItems;
              }

              // Add new item to the top of the list
              return [newItemRef, ...existingItems];
            },
          },
        });
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
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    update(cache, { data }, { variables }) {
      if (!data?.removeItemFromShoppingList || !listId || !variables) return;

      try {
        const itemId = variables.id;

        // Remove the item from the cache using cache.modify (proper approach)
        cache.modify({
          fields: {
            shoppingListItems(existingItems = [], { readField }) {
              return existingItems.filter(
                (itemRef: any) => readField('id', itemRef) !== itemId,
              );
            },
          },
        });

        // Evict the removed item from cache
        cache.evict({
          id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        });
        cache.gc(); // Garbage collect orphaned data
      } catch (error) {
        console.warn(
          'Cache update failed for removeItem, will refetch:',
          error,
        );
        // Fallback: refetch if cache update fails
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

  const [togglePurchasedMutation] = useToggleShoppingListItemPurchasedMutation({
    errorPolicy: 'all',
    // Use cache.modify for instant UI updates without optimistic response
    // This avoids "Missing field" warnings from partial fragments
    update(cache, { data }, { variables }) {
      if (!data?.toggleShoppingListItemPurchased || !variables) return;

      const itemId = variables.id;
      const newStatus = variables.purchased;

      // Directly modify the cached item's fields
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fields: {
          isPurchased() {
            return newStatus;
          },
          updatedAt() {
            return new Date().toISOString();
          },
        },
      });
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Toggle Item Purchased',
      });
      Alert.alert('Error', message);
    },
  });

  // Simplified add item
  const addItem = async (input: ShoppingListItemInput) => {
    if (!listId) return false;

    try {
      const result = await addItemMutation({
        variables: {
          input: {
            shoppingListId: listId,
            itemName: input.itemName,
            quantity: input.quantity ?? 1,
            ...(input.unitName && { unitName: input.unitName }),
            ...(input.unitId && { unitId: input.unitId }),
            ...(input.notes && { notes: input.notes }),
            ...(input.category && { category: input.category }),
          },
        },
      });

      return result.data?.addItemToShoppingList ?? false;
    } catch (error) {
      console.error('Add shopping list item error:', error);
      return false;
    }
  };

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

  // Simplified remove item
  const removeItem = async (itemId: string) => {
    if (!listId) return false;

    try {
      await removeItemMutation({
        variables: { id: itemId },
      });

      return true;
    } catch (error) {
      console.error('Remove shopping list item error:', error);
      return false;
    }
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
    loading,
    error,
    stats,

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

import { useMemo } from 'react';
import { Alert } from 'react-native';
import {
  useGetShoppingListItemsQuery,
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useToggleShoppingListItemPurchasedMutation,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';
import { useErrorHandler } from '#/utils/errorHandling';
import { usePreservedArrayData } from '#/hooks/apollo';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import {
  enhanceWithVersion,
  createOptimisticEntity,
} from '#/apollo/utils/createOptimisticResponse';
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
  const { isLoggedOut } = useAuth();
  const { handleApolloError } = useErrorHandler();
  const shouldSkip = !listId || isLoggedOut;

  // Watch cache for updates from mutations
  const queryResult = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network', // Fetch from network while showing cache (ensures first load works)
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
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
    const completed = items.filter(item => item.isPurchased).length;
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
    // Minimal optimistic response for instant UI feedback (critical for offline)
    optimisticResponse: variables => {
      const tempId = `temp-${generateId()}`;
      return {
        __typename: 'Mutation' as const,
        addItemToShoppingList: {
          ...createOptimisticEntity('ShoppingListItem', tempId, {
            itemName: variables.input.itemName,
            quantity: variables.input.quantity || 1,
            isPurchased: false,
            unitName: variables.input.unitName || null,
            notes: variables.input.notes || null,
            category: variables.input.category || null,
            shoppingList: {
              __typename: 'ShoppingList',
              id: listId || '',
            },
            unit: variables.input.unitId
              ? {
                  __typename: 'Unit',
                  id: variables.input.unitId,
                }
              : null,
          }),
          __typename: 'ShoppingListItem' as const,
        } as any, // Optimistic response - will be replaced by server response
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
    // Enhanced optimistic response with version management
    optimisticResponse: variables => {
      // Find the current item to preserve its fields
      const currentItem = items.find(item => item.id === variables.id);

      if (!currentItem) {
        // Fallback for edge case where item not in cache
        return {
          __typename: 'Mutation',
          updateShoppingListItem: {
            __typename: 'ShoppingListItem',
            id: variables.id,
            version: 1,
            updatedAt: new Date().toISOString(),
            ...variables.input,
          } as any,
        };
      }

      // Use version-aware helper to create optimistic response
      // This automatically keeps current version and updates timestamp
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
        updateShoppingListItem: optimisticUpdate as any,
      };
    },
    // Cache update happens automatically via Apollo's normalization
    // The mutation returns the full ShoppingListItemFragment, so Apollo merges it automatically
    // The optimistic response provides instant UI feedback
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
    // Optimistic response for instant toggle feedback
    optimisticResponse: variables => {
      const currentItem = items.find(item => item.id === variables.id);

      if (!currentItem) {
        // Fallback for edge case
        return {
          __typename: 'Mutation',
          toggleShoppingListItemPurchased: {
            __typename: 'ShoppingListItem',
            id: variables.id,
            isPurchased: variables.purchased,
            version: 1,
            updatedAt: new Date().toISOString(),
          } as any,
        };
      }

      // Use version-aware helper for optimistic response
      const optimisticUpdate = enhanceWithVersion(
        {
          ...currentItem,
          updatedAt: currentItem.updatedAt ?? new Date().toISOString(),
        } as any,
        {
          isPurchased: variables.purchased,
        },
      );

      return {
        __typename: 'Mutation',
        toggleShoppingListItemPurchased: optimisticUpdate as any,
      };
    },
    // Cache update happens automatically via Apollo's normalization
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
      // Get current version from cache for optimistic concurrency control
      const currentItem = items.find(item => item.id === itemId);
      const currentVersion = currentItem?.version;

      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: {
            ...updates,
            // Include version for server-side concurrency control
            version: currentVersion,
          },
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
      // Find current item to determine its purchased status
      const currentItem = items.find(item => item.id === itemId);
      if (!currentItem) return false;

      // Toggle the status - use isPurchased field as primary source
      const newStatus = !currentItem.isPurchased;

      // Use specialized toggle mutation with version for optimistic concurrency
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

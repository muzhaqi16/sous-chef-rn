import { useMemo } from 'react';
import { Alert } from 'react-native';
import {
  useGetShoppingListItemsQuery,
  useShoppingListItemsChangedSubscription,
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useMarkItemPurchasedMutation,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';
import { useErrorHandler } from '#/utils/errorHandling';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { useSubscriptionDeduplication } from '#/hooks/utils/useSubscriptionDeduplication';

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
 * Simplified shopping list management hook using Apollo Client only
 * No custom caches, no complex state management - just Apollo
 */
export function useShoppingListManagement(listId: string | undefined) {
  const { isLoggedOut, user } = useAuth();
  const { handleApolloError } = useErrorHandler();
  const shouldSkip = !listId || isLoggedOut;

  // Subscription deduplication filter
  const shouldProcessUpdate = useSubscriptionDeduplication(user?.id);

  // Single source of truth: Apollo cache
  const { data, loading, error, refetch } = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  // Real-time updates via subscription with deduplication
  useShoppingListItemsChangedSubscription({
    variables: { listId: listId ?? '' },
    skip: shouldSkip,
    onData: ({ data }) => {
      const payload = data.data?.shoppingListItemsChanged;

      // Filter out self-echo and duplicate updates
      if (!shouldProcessUpdate(payload)) {
        return;
      }

      // Apollo Client automatically updates cache via normalization
      // No manual cache update needed - the subscription data is merged automatically
      console.log('✅ Processing subscription update from other user:', {
        userId: payload?.userId,
        mutation: payload?.mutation,
        itemId: payload?.item?.id,
      });
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Shopping List Subscription',
      });
      console.warn('❌ Shopping list subscription error:', {
        listId,
        error: message,
        timestamp: new Date().toISOString(),
      });
      // Don't refetch on subscription errors - let the query handle reconnection
    },
  });

  const items = useMemo(
    () => data?.shoppingListItems ?? [],
    [data?.shoppingListItems],
  );

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

  // Mutations
  const [addItemMutation] = useAddItemToShoppingListMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Add Shopping List Item',
      });
      Alert.alert('Error', message);
    },
    // Update Apollo cache directly instead of refetching
    // Note: No optimisticResponse - the mutation returns 40+ fields from ShoppingListItemFragment
    // The cache update provides instant UI feedback when server responds (~100-200ms)
    update: (cache, { data }) => {
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

              // Add new item to the list
              return [...existingItems, newItemRef];
            },
          },
        });
      } catch (error) {
        console.warn('Cache update failed for addItem, will refetch:', error);
        // Fallback: refetch if cache update fails
        refetch();
      }
    },
  });

  const [updateItemMutation] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      Alert.alert('Error', message);
    },
    // Cache update happens automatically via Apollo's normalization
    // The mutation returns the full ShoppingListItemFragment, so Apollo merges it automatically
    // No manual cache update needed!
  });

  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Shopping List Item',
      });
      Alert.alert('Error', message);
    },
    // Optimistic response for instant removal
    optimisticResponse: _variables => ({
      __typename: 'Mutation',
      removeItemFromShoppingList: true,
    }),
    // Update cache to remove the item
    update: (cache, { data }, { variables }) => {
      if (!data?.removeItemFromShoppingList || !listId || !variables) return;

      try {
        const itemId = variables.id;

        // Remove the item from the cache
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
        refetch();
      }
    },
  });

  const [markPurchasedMutation] = useMarkItemPurchasedMutation({
    errorPolicy: 'all', // Allow offline mutations
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Mark Item Purchased',
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
          markItemPurchased: {
            __typename: 'ShoppingListItem',
            id: variables.id,
            isPurchased: variables.status,
            version: 1,
            updatedAt: new Date().toISOString(),
            purchasedBy: variables.status
              ? { __typename: 'User', id: '', email: '' }
              : null,
          } as any,
        };
      }

      // Use version-aware helper to create optimistic response
      // This automatically increments version and updates timestamp
      const optimisticUpdate = enhanceWithVersion(currentItem, {
        isPurchased: variables.status,
        // Cast purchasedBy to match GraphQL type - server will fill in full user data
        purchasedBy: variables.status ? ({...currentItem.purchasedBy} as any) : null,
      });

      return {
        __typename: 'Mutation',
        markItemPurchased: optimisticUpdate as any,
      };
    },
    // No manual cache update needed - Apollo automatically merges the mutation response
    // with the existing cache entry via normalization. The optimistic response provides
    // instant UI feedback, and the server response updates the cache automatically.
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
      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: updates,
        },
      });

      return result.data?.updateShoppingListItem ?? false;
    } catch (error) {
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

      const result = await markPurchasedMutation({
        variables: {
          id: itemId,
          status: newStatus,
        },
      });

      return result.data?.markItemPurchased ?? false;
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

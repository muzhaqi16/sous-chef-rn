import { useMemo } from 'react';
import { Alert } from 'react-native';
import {
  useGetShoppingListItemsQuery,
  useShoppingListItemsChangedSubscription,
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useMarkItemPurchasedMutation,
  GetShoppingListItemsDocument,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';
import { useErrorHandler } from '#/utils/errorHandling';

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
  const { isLoggedOut } = useAuth();
  const { handleApolloError } = useErrorHandler();
  const shouldSkip = !listId || isLoggedOut;

  // Single source of truth: Apollo cache
  const { data, loading, error, refetch } = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  // Real-time updates via subscription - let Apollo handle cache automatically
  useShoppingListItemsChangedSubscription({
    variables: { listId: listId ?? '' },
    skip: shouldSkip,
    onData: () => {
      // Apollo cache is automatically updated by subscription
      // No manual cache manipulation needed - just let Apollo work
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Shopping List Subscription',
      });
      console.warn('Shopping list subscription error:', message);
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
    refetchQueries: [
      {
        query: GetShoppingListItemsDocument,
        variables: { shoppingListId: listId ?? '' },
      },
    ],
    awaitRefetchQueries: false, // Don't wait for refetch to complete
  });

  const [updateItemMutation] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Shopping List Item',
      });
      Alert.alert('Error', message);
    },
    refetchQueries: [
      {
        query: GetShoppingListItemsDocument,
        variables: { shoppingListId: listId ?? '' },
      },
    ],
    awaitRefetchQueries: false, // Don't wait for refetch to complete
  });

  const [markPurchasedMutation] = useMarkItemPurchasedMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Mark Item Purchased',
      });
      Alert.alert('Error', message);
    },
    refetchQueries: [
      {
        query: GetShoppingListItemsDocument,
        variables: { shoppingListId: listId ?? '' },
      },
    ],
    awaitRefetchQueries: false, // Don't wait for refetch to complete
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

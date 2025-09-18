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
  const shouldSkip = !listId || isLoggedOut;

  // Single source of truth: Apollo cache
  const { data, loading, error, refetch } = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  // Real-time updates via subscription
  useShoppingListItemsChangedSubscription({
    variables: { listId: listId ?? '' },
    skip: shouldSkip,
    onData: () => {
      // Apollo cache automatically updated
    },
    onError: error => {
      console.warn('Shopping list subscription error:', error.message);
      refetch();
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
    const completed = items.filter(item => !!item.purchasedBy).length;
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
      console.error('Add shopping list item error:', error);
      Alert.alert('Error', 'Failed to add item');
    },
  });

  const [updateItemMutation] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Update shopping list item error:', error);
      Alert.alert('Error', 'Failed to update item');
    },
  });

  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Remove shopping list item error:', error);
      Alert.alert('Error', 'Failed to remove item');
    },
  });

  const [markPurchasedMutation] = useMarkItemPurchasedMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Mark shopping list item purchased error:', error);
      Alert.alert('Error', 'Failed to mark item as purchased');
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
        refetchQueries: ['GetShoppingListItems'],
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
        refetchQueries: ['GetShoppingListItems'],
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
        refetchQueries: ['GetShoppingListItems'],
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

      // Toggle the status - if it has purchasedBy, it's purchased
      const newStatus = !currentItem.purchasedBy;

      const result = await markPurchasedMutation({
        variables: {
          id: itemId,
          status: newStatus,
        },
        refetchQueries: ['GetShoppingListItems'],
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
    getCompletedItems: () => items.filter(item => !!item.purchasedBy),
    getPendingItems: () => items.filter(item => !item.purchasedBy),
    getItemsByCategory: (category: string) =>
      items.filter(item => item.category === category),
  };
}

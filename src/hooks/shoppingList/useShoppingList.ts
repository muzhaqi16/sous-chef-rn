import {useMemo, useCallback} from 'react';
import {Alert} from 'react-native';
import {useSearchableList} from '../useSearchableList';
import {
  useShoppingListValidation,
  useShoppingListData,
  useShoppingListSubscription,
} from './internal';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useMarkItemPurchasedMutation,
  CreateShoppingListItemInput,
  UpdateShoppingListItemInput,
  GetShoppingListItemsDocument,
  ShoppingListItemFragment,
} from '#generated';

/**
 * Main hook for managing shopping list items with caching, real-time updates, and search
 * 
 * @param listId - The shopping list ID to fetch items for
 * @returns Object containing items, loading states, search functionality, and refetch method
 */
export function useShoppingList(listId: string | null) {
  // Validate that the listId belongs to the current user
  const {isValid: isValidListId, safeListId} = useShoppingListValidation(listId);

  // Handle GraphQL queries and data fetching (now includes cache management)
  const {
    items,
    loading: queryLoading,
    refreshing: queryRefreshing,
    refetch: queryRefetch,
    error: queryError,
    hasLoadedCache,
  } = useShoppingListData(safeListId);

  // Mutations for item management
  const [addItemMutation] = useAddItemToShoppingListMutation({
    // Update cache immediately for optimistic UI
    update: (cache, {data: mutationData}: any) => {
      if (!mutationData?.addItemToShoppingList || !safeListId) return;

      const newItem = mutationData.addItemToShoppingList;

      try {
        // Read the current shopping list items from cache
        const existingData = cache.readQuery<{
          shoppingListItems: ShoppingListItemFragment[];
        }>({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: safeListId},
        });

        if (existingData?.shoppingListItems) {
          // Add the new item to the list
          cache.writeQuery({
            query: GetShoppingListItemsDocument,
            variables: {shoppingListId: safeListId},
            data: {
              shoppingListItems: [newItem, ...existingData.shoppingListItems],
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed:', error);
        // Cache update failed, but mutation still succeeded
      }
    },
  });
  const [updateItemMutation] = useUpdateShoppingListItemMutation();
  const [removeItemMutation] = useRemoveItemFromShoppingListMutation();
  const [markItemPurchasedMutation] = useMarkItemPurchasedMutation();

  // Handle real-time subscriptions
  useShoppingListSubscription(safeListId, {
    onItemsChanged: () => {
      // Trigger a refetch to get the latest data
      queryRefetch();
    },
    onError: (error) => {
      console.error('Subscription error:', error);
      // Refetch on subscription errors to ensure consistency
      queryRefetch();
    },
  });
  
  // Add search functionality
  const {query, setQuery, filtered: searchedItems} = useSearchableList(
    items,
    (item, searchQuery) =>
      !!item.itemName && item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Loading states
  const isInitialLoading = queryLoading && !hasLoadedCache && items.length === 0;
  const isRefreshing = queryRefreshing;

  // Enhanced refetch
  const refetch = async () => {
    if (!safeListId) return;

    try {
      return await queryRefetch();
    } catch (error) {
      console.error('Refetch failed:', error);
      throw error;
    }
  };

  // Add item to this specific shopping list
  const addItem = useCallback(async (itemInput: Omit<CreateShoppingListItemInput, 'shoppingListId'>) => {
    if (!safeListId) {
      Alert.alert('Error', 'No shopping list selected');
      return false;
    }

    try {
      const result = await addItemMutation({
        variables: {
          input: {
            ...itemInput,
            shoppingListId: safeListId,
          },
        },
      });

      if (result.data?.addItemToShoppingList) {
        // Cache is updated automatically via the update function
        // No need for manual refetch - UI should update immediately
        return result.data.addItemToShoppingList;
      }
      return false;
    } catch (error) {
      console.error('Add item error:', error);
      Alert.alert('Error', 'Failed to add item to shopping list');
      return false;
    }
  }, [safeListId, addItemMutation]);

  // Update item in this shopping list
  const updateItem = useCallback(async (itemId: string, updates: UpdateShoppingListItemInput) => {
    if (!safeListId) return false;

    try {
      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: updates,
        },
      });

      if (result.data?.updateShoppingListItem) {
        await queryRefetch();
        return result.data.updateShoppingListItem;
      }
      return false;
    } catch (error) {
      console.error('Update item error:', error);
      Alert.alert('Error', 'Failed to update item');
      return false;
    }
  }, [safeListId, updateItemMutation, queryRefetch]);

  // Remove item from this shopping list
  const removeItem = useCallback(async (itemId: string) => {
    if (!safeListId) return false;

    try {
      await removeItemMutation({
        variables: { id: itemId },
      });
      await queryRefetch();
      return true;
    } catch (error) {
      console.error('Remove item error:', error);
      Alert.alert('Error', 'Failed to remove item');
      return false;
    }
  }, [safeListId, removeItemMutation, queryRefetch]);

  // Mark item as purchased
  const markItemPurchased = useCallback(async (itemId: string, isPurchased: boolean) => {
    if (!safeListId) return false;

    try {
      const result = await markItemPurchasedMutation({
        variables: {
          id: itemId,
          status: isPurchased,
        },
      });

      if (result.data?.markItemPurchased) {
        await queryRefetch();
        return result.data.markItemPurchased;
      }
      return false;
    } catch (error) {
      console.error('Mark item purchased error:', error);
      Alert.alert('Error', 'Failed to update purchase status');
      return false;
    }
  }, [safeListId, markItemPurchasedMutation, queryRefetch]);
  
  return {
    // Data
    items: searchedItems,

    // Search
    query,
    setQuery,

    // Loading states
    loading: isInitialLoading,
    refreshing: isRefreshing,

    // Cache info
    hasLoadedCache,

    // Actions
    refetch,
    addItem,
    updateItem,
    removeItem,
    markItemPurchased,

    // Validation
    isValidList: isValidListId,

    // Error state
    error: queryError,
  };
}
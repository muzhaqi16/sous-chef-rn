import { useMemo, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  useGetShoppingListsQuery,
  useShoppingListItemsChangedSubscription,
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useMarkItemPurchasedMutation,
  useCreateShoppingListMutation,
  useUpdateShoppingListMutation,
  useDeleteShoppingListMutation,
  GetShoppingListsDocument,
  GetShoppingListItemsDocument,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { ApolloClient } from '@apollo/client';
import { shoppingListStorage } from '#/storage/shoppingListCache';
import { useStore } from '#store';

export interface ShoppingListItemInput {
  itemName: string;
  quantity: number;
  unitId?: string;
  estimatedPrice?: number;
  budgetPrice?: number;
  notes?: string;
  category?: string;
  priority?: number;
  itemBarcode?: string;
  preferredStoreId?: string;
}

export interface ShoppingListItemUpdate extends Partial<ShoppingListItemInput> {
  isPurchased?: boolean;
  purchasedQuantity?: number;
  purchasedPrice?: number;
}

export interface ShoppingListInput {
  name: string;
  description?: string;
  budgetAmount?: number;
  currency?: string;
  category?: string;
  priority?: number;
  targetStoreId?: string;
  tags?: string[];
}

export function useShoppingListManagement() {
  // Get user state to check for logout
  const user = useStore(state => state.user);
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const isLoggedOut = !user;

  // Local state - MMKV is source of truth
  const [lists, setLists] = useState<any[]>([]);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  // Load from MMKV immediately on mount
  useEffect(() => {
    if (!isLoggedOut) {
      const cachedLists = shoppingListStorage.getShoppingLists();
      if (cachedLists && cachedLists.length > 0) {
        setLists(cachedLists);
        setHasLoadedCache(true);
      } else {
        setLists([]);
        setHasLoadedCache(false);
      }
    } else {
      setLists([]);
      setHasLoadedCache(false);
    }
  }, [isLoggedOut]);

  // Simple query - always fetch fresh, no Apollo cache complexity
  const {
    refetch: networkRefetch,
    loading,
    data: queryData,
    error: queryError,
  } = useGetShoppingListsQuery({
    skip: isLoggedOut || isLoggingOut,
    fetchPolicy: 'network-only', // Always fetch fresh
    notifyOnNetworkStatusChange: true,
  });

  // Handle completed and error with useEffect
  useEffect(() => {
    if (queryData?.shoppingLists) {
      // Update MMKV (source of truth)
      shoppingListStorage.setShoppingLists(queryData.shoppingLists, user?.id);
      // Update local state
      setLists(queryData.shoppingLists);
    }
  }, [queryData, user?.id]);

  useEffect(() => {
    if (queryError) {
      console.warn(
        'Network query failed, using cached data:',
        queryError.message,
      );
      // We already have MMKV cache loaded, so no need to do anything
    }
  }, [queryError]);

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredLists,
  } = useSearchableList(lists, (list, q) => {
    const searchTerm = q.toLowerCase();
    return (
      list?.name?.toLowerCase().includes(searchTerm) ||
      list?.description?.toLowerCase().includes(searchTerm)
    );
  });

  // Mutations with optimistic updates
  const [createListMutation] = useCreateShoppingListMutation();
  const [updateListMutation] = useUpdateShoppingListMutation();
  const [deleteListMutation] = useDeleteShoppingListMutation();
  const [addItemMutation] = useAddItemToShoppingListMutation();
  const [updateItemMutation] = useUpdateShoppingListItemMutation();
  const [removeItemMutation] = useRemoveItemFromShoppingListMutation();
  const [markItemPurchasedMutation] = useMarkItemPurchasedMutation();

  // Create list with optimistic update
  const createList = async (input: ShoppingListInput) => {
    // Optimistically update MMKV and UI
    const optimisticList = {
      id: `temp-${Date.now()}`,
      ...input,
      isCompleted: false,
      totalItems: 0,
      completedItems: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __typename: 'ShoppingList',
    };

    const currentLists = lists;
    const newLists = [...currentLists, optimisticList];
    shoppingListStorage.setShoppingLists(newLists, user?.id);
    setLists(newLists);

    try {
      const result = await createListMutation({
        variables: { input },
      });

      if (result.data?.createShoppingList) {
        // Refetch to get complete data
        await networkRefetch();
        return result.data.createShoppingList;
      }
    } catch (error) {
      // Rollback on error
      shoppingListStorage.setShoppingLists(currentLists, user?.id);
      setLists(currentLists);
      console.error('Create list error:', error);
      Alert.alert('Error', 'Failed to create shopping list');
    }

    return false;
  };

  // Update list
  const updateList = async (
    listId: string,
    updates: Partial<ShoppingListInput>,
  ) => {
    // Optimistic update
    const currentLists = lists;
    const updatedLists = currentLists.map(list =>
      list.id === listId ? { ...list, ...updates } : list,
    );
    shoppingListStorage.setShoppingLists(updatedLists, user?.id);
    setLists(updatedLists);

    try {
      const result = await updateListMutation({
        variables: {
          id: listId,
          input: updates,
        },
      });

      if (result.data?.updateShoppingList) {
        // Refetch to get complete updated data
        await networkRefetch();
        return result.data.updateShoppingList;
      }
    } catch (error) {
      // Rollback on error
      shoppingListStorage.setShoppingLists(currentLists, user?.id);
      setLists(currentLists);
      console.error('Update list error:', error);
      Alert.alert('Error', 'Failed to update shopping list');
    }

    return false;
  };

  // Delete list
  const deleteList = async (listId: string) => {
    return new Promise<boolean>(resolve => {
      Alert.alert(
        'Delete Shopping List',
        'Are you sure you want to delete this shopping list? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              // Optimistic update
              const currentLists = lists;
              const filteredLists = currentLists.filter(
                list => list.id !== listId,
              );
              shoppingListStorage.setShoppingLists(filteredLists, user?.id);
              shoppingListStorage.removeShoppingList(listId);
              setLists(filteredLists);

              try {
                await deleteListMutation({
                  variables: { id: listId },
                });

                // Refetch to ensure consistency
                await networkRefetch();
                resolve(true);
              } catch (error) {
                // Rollback on error
                shoppingListStorage.setShoppingLists(currentLists, user?.id);
                setLists(currentLists);
                console.error('Delete list error:', error);
                Alert.alert('Error', 'Failed to delete shopping list');
                resolve(false);
              }
            },
          },
        ],
      );
    });
  };

  // Add item to shopping list
  const addItem = async (listId: string, input: ShoppingListItemInput) => {
    try {
      const result = await addItemMutation({
        variables: {
          input: {
            shoppingListId: listId,
            ...input,
          },
        },
      });

      if (result.data?.addItemToShoppingList) {
        // No need for optimistic updates - just trigger a refetch
        // This ensures we always have consistent data
        console.log('✅ Added item, triggering refetch');
        return result.data.addItemToShoppingList;
      }
      return false;
    } catch (error) {
      console.error('Add item error:', error);
      Alert.alert('Error', 'Failed to add item to shopping list');
      return false;
    }
  };

  // Update shopping list item
  const updateItem = async (
    itemId: string,
    updates: ShoppingListItemUpdate,
  ) => {
    try {
      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: updates,
        },
      });

      if (result.data?.updateShoppingListItem) {
        return result.data.updateShoppingListItem;
      }
      return false;
    } catch (error) {
      console.error('Update item error:', error);
      Alert.alert('Error', 'Failed to update item');
      return false;
    }
  };

  // Remove item from shopping list
  const removeItem = async (itemId: string) => {
    try {
      await removeItemMutation({
        variables: { id: itemId },
      });
      return true;
    } catch (error) {
      console.error('Remove item error:', error);
      Alert.alert('Error', 'Failed to remove item');
      return false;
    }
  };

  // Mark item as purchased
  const markItemPurchased = async (itemId: string, isPurchased: boolean) => {
    try {
      const result = await markItemPurchasedMutation({
        variables: {
          id: itemId,
          status: isPurchased,
        },
      });

      if (result.data?.markItemPurchased) {
        return result.data.markItemPurchased;
      }
      return false;
    } catch (error) {
      console.error('Mark item purchased error:', error);
      Alert.alert('Error', 'Failed to update purchase status');
      return false;
    }
  };

  // Shopping list statistics
  const stats = useMemo(() => {
    if (!lists || lists.length === 0) {
      return {
        totalLists: 0,
        completedLists: 0,
        totalItems: 0,
        totalPurchased: 0,
        totalEstimatedCost: 0,
        totalBudget: 0,
      };
    }

    const totalLists = lists.length;
    const completedLists = lists.filter(list => list.isCompleted).length;
    const totalItems = lists.reduce(
      (sum, list) => sum + (list.totalItems || 0),
      0,
    );
    const totalPurchased = lists.reduce(
      (sum, list) => sum + (list.completedItems || 0),
      0,
    );
    const totalEstimatedCost = lists.reduce(
      (sum, list) => sum + (list.estimatedTotal || 0),
      0,
    );
    const totalBudget = lists.reduce(
      (sum, list) => sum + (list.budgetAmount || 0),
      0,
    );

    return {
      totalLists,
      completedLists,
      totalItems,
      totalPurchased,
      totalEstimatedCost,
      totalBudget,
    };
  }, [lists]);

  // Enhanced refetch
  const refetch = async () => {
    if (isLoggedOut || isLoggingOut) return;

    try {
      const result = await networkRefetch();
      return result;
    } catch (error) {
      console.error('Refetch failed:', error);
      throw error;
    }
  };

  return {
    // Data
    lists: filteredLists,
    allLists: lists,
    loading,
    refreshing: false, // Simplified - no separate refreshing state
    hasLoadedCache,
    stats,

    // Search
    searchQuery,
    setSearchQuery,

    // Loading states (simplified)
    creating: false,
    updating: false,
    deleting: false,
    addingItem: false,
    updatingItem: false,
    removingItem: false,
    markingPurchased: false,

    // Cache info for debugging
    cacheInfo: shoppingListStorage.getCacheInfo(),

    // List actions
    createList,
    updateList,
    deleteList,
    refetch,

    // Item actions
    addItem,
    updateItem,
    removeItem,
    markItemPurchased,

    // Helper functions
    getListById: (listId: string) => lists.find(list => list.id === listId),
    getDefaultList: () => lists.find(list => list.isDefault),
    getCompletedLists: () => lists.filter(list => list.isCompleted),
    getActiveLists: () => lists.filter(list => !list.isCompleted),
  };
}

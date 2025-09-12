import {useMemo, useState, useEffect} from 'react';
import {Alert} from 'react-native';
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
import {useSearchableList} from '../useSearchableList';
import {ApolloClient} from '@apollo/client';
import {shoppingListStorage} from '#/storage/shoppingListCache';
import {useStore} from '#store';

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

  // State for optimistic/cached lists
  const [optimisticLists, setOptimisticLists] = useState<any[]>([]);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  // Clear optimistic state immediately on logout
  useEffect(() => {
    if (isLoggedOut) {
      setOptimisticLists([]);
      setHasLoadedCache(false);
    }
  }, [isLoggedOut]);

  // Load cached lists immediately on mount
  useEffect(() => {
    const cachedLists = shoppingListStorage.getShoppingLists();
    if (cachedLists && cachedLists.length > 0) {
      setOptimisticLists(cachedLists);
      setHasLoadedCache(true);
    } else {
      setOptimisticLists([]);
      setHasLoadedCache(false);
    }
  }, []);

  // Cache-first query - try cache first, skip during logout
  const {data: cachedData, loading: cacheLoading} = useGetShoppingListsQuery({
    skip: isLoggedOut || isLoggingOut,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
  });

  // Network query - fetch updates in background, skip during logout
  const {
    data: networkData,
    loading: networkLoading,
    error,
    refetch: networkRefetch,
  } = useGetShoppingListsQuery({
    skip: isLoggedOut || isLoggingOut,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      // Update MMKV cache when network data arrives (only if not logging out)
      if (data?.shoppingLists && !isLoggedOut && !isLoggingOut) {
        shoppingListStorage.setShoppingLists(data.shoppingLists, user?.id);
        setOptimisticLists(data.shoppingLists);
      }
    },
  });

  // Determine which data to use - prioritize network data, then cached data, then optimistic
  const shoppingLists = useMemo(() => {
    if (networkData?.shoppingLists) {
      return networkData.shoppingLists;
    }
    if (cachedData?.shoppingLists) {
      return cachedData.shoppingLists;
    }
    return optimisticLists;
  }, [networkData?.shoppingLists, cachedData?.shoppingLists, optimisticLists]);

  // Loading states
  const isInitialLoading = cacheLoading && !hasLoadedCache && optimisticLists.length === 0;
  const isRefreshing = networkLoading && (shoppingLists.length > 0 || hasLoadedCache);

  // Simple search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredLists,
  } = useSearchableList(shoppingLists, (list, q) => {
    const searchTerm = q.toLowerCase();
    return list?.name?.toLowerCase().includes(searchTerm) ||
           list?.description?.toLowerCase().includes(searchTerm);
  });

  // Create shopping list mutation
  const [createListMutation, {loading: creating}] = useCreateShoppingListMutation({
    update: (cache, {data}) => {
      if (data?.createShoppingList) {
        const existingLists = cache.readQuery({query: GetShoppingListsDocument}) as {shoppingLists: any[]} | null;

        if (existingLists?.shoppingLists) {
          const updatedLists = [...existingLists.shoppingLists, data.createShoppingList];
          cache.writeQuery({
            query: GetShoppingListsDocument,
            data: {shoppingLists: updatedLists},
          });

          // Update MMKV cache and optimistic state
          if (!isLoggedOut && !isLoggingOut) {
            shoppingListStorage.setShoppingLists(updatedLists, user?.id);
            setOptimisticLists(updatedLists);
          }
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to create shopping list');
      console.error('Create shopping list error:', error);
    },
  });

  // Update shopping list mutation
  const [updateListMutation, {loading: updating}] = useUpdateShoppingListMutation({
    update: (cache, {data}) => {
      if (data?.updateShoppingList) {
        // Update lists cache
        const existingLists = cache.readQuery({query: GetShoppingListsDocument}) as {shoppingLists: any[]} | null;
        if (existingLists?.shoppingLists) {
          const updatedLists = existingLists.shoppingLists.map((list: any) =>
            list.id === data.updateShoppingList.id
              ? {...list, ...data.updateShoppingList}
              : list,
          );

          cache.writeQuery({
            query: GetShoppingListsDocument,
            data: {shoppingLists: updatedLists},
          });

          // Update MMKV cache and optimistic state
          if (!isLoggedOut && !isLoggingOut) {
            shoppingListStorage.setShoppingLists(updatedLists, user?.id);
            setOptimisticLists(updatedLists);
          }
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to update shopping list');
      console.error('Update shopping list error:', error);
    },
  });

  // Delete shopping list mutation
  const [deleteListMutation, {loading: deleting}] = useDeleteShoppingListMutation({
    update: (cache, {data}, {variables}) => {
      if (data?.deleteShoppingList && variables?.id) {
        const existingLists = cache.readQuery({query: GetShoppingListsDocument}) as {shoppingLists: any[]} | null;
        if (existingLists?.shoppingLists) {
          const filteredLists = existingLists.shoppingLists.filter(
            (list: any) => list.id !== variables.id,
          );

          cache.writeQuery({
            query: GetShoppingListsDocument,
            data: {shoppingLists: filteredLists},
          });

          // Update MMKV cache and optimistic state
          if (!isLoggedOut && !isLoggingOut) {
            shoppingListStorage.setShoppingLists(filteredLists, user?.id);
            shoppingListStorage.removeShoppingList(variables.id as string);
            setOptimisticLists(filteredLists);
          }
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to delete shopping list');
      console.error('Delete shopping list error:', error);
    },
  });

  // Add item to shopping list mutation
  const [addItemMutation, {loading: addingItem}] = useAddItemToShoppingListMutation({
    update: (cache, {data}, {variables}) => {
      if (data?.addItemToShoppingList && variables?.input?.shoppingListId) {
        const listId = variables.input.shoppingListId;
        const existingItems = cache.readQuery({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
        }) as {shoppingListItems: any[]} | null;

        if (existingItems?.shoppingListItems) {
          const updatedItems = [...existingItems.shoppingListItems, data.addItemToShoppingList];
          cache.writeQuery({
            query: GetShoppingListItemsDocument,
            variables: {shoppingListId: listId},
            data: {shoppingListItems: updatedItems},
          });

          // Update MMKV cache
          if (!isLoggedOut && !isLoggingOut) {
            shoppingListStorage.setShoppingListItems(listId, updatedItems);
          }
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to add item to shopping list');
      console.error('Add shopping list item error:', error);
    },
  });

  // Update shopping list item mutation
  const [updateItemMutation, {loading: updatingItem}] = useUpdateShoppingListItemMutation({
    update: (cache, {data}, {variables}) => {
      if (data?.updateShoppingListItem) {
        // Find which list this item belongs to (we need the listId)
        const item = data.updateShoppingListItem;
        const listId = (item as any).shoppingListId;
        
        if (listId) {
          const existingItems = cache.readQuery({
            query: GetShoppingListItemsDocument,
            variables: {shoppingListId: listId},
          }) as {shoppingListItems: any[]} | null;

          if (existingItems?.shoppingListItems) {
            const updatedItems = existingItems.shoppingListItems.map((existingItem: any) =>
              existingItem.id === item.id ? {...existingItem, ...item} : existingItem,
            );

            cache.writeQuery({
              query: GetShoppingListItemsDocument,
              variables: {shoppingListId: listId},
              data: {shoppingListItems: updatedItems},
            });

            // Update MMKV cache
            if (!isLoggedOut && !isLoggingOut) {
              shoppingListStorage.setShoppingListItems(listId, updatedItems);
            }
          }
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to update item');
      console.error('Update shopping list item error:', error);
    },
  });

  // Remove item from shopping list mutation
  const [removeItemMutation, {loading: removingItem}] = useRemoveItemFromShoppingListMutation({
    update: (cache, {data}, {variables}) => {
      if (data?.removeItemFromShoppingList && variables?.id) {
        // We need to find which list this item belonged to
        // This might require additional context or a different approach
        console.log('Item removed:', variables.id);
        // Note: This might need enhancement to properly update the cache
        // since we don't have the listId in the response
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to remove item');
      console.error('Remove shopping list item error:', error);
    },
  });

  // Mark item as purchased mutation
  const [markItemPurchasedMutation, {loading: markingPurchased}] = useMarkItemPurchasedMutation({
    update: (cache, {data}, {variables}) => {
      if (data?.markItemPurchased && variables?.id) {
        // Similar to updateItem, we need the listId to update the cache properly
        const item = data.markItemPurchased;
        // This might need enhancement to get the listId
        console.log('Item purchase status updated:', item);
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to update purchase status');
      console.error('Mark item purchased error:', error);
    },
  });

  // Helper functions
  const createList = async (input: ShoppingListInput) => {
    try {
      const result = await createListMutation({
        variables: {input},
      });

      if (result.data?.createShoppingList) {
        return result.data.createShoppingList;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const updateList = async (listId: string, updates: Partial<ShoppingListInput>) => {
    try {
      const result = await updateListMutation({
        variables: {
          id: listId,
          input: updates,
        },
      });

      if (result.data?.updateShoppingList) {
        return result.data.updateShoppingList;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

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
              try {
                await deleteListMutation({
                  variables: {id: listId},
                });
                resolve(true);
              } catch (error) {
                resolve(false);
              }
            },
          },
        ],
      );
    });
  };

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
        return result.data.addItemToShoppingList;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const updateItem = async (itemId: string, updates: ShoppingListItemUpdate) => {
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
      return false;
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await removeItemMutation({
        variables: {id: itemId},
      });
      return true;
    } catch (error) {
      return false;
    }
  };

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
      return false;
    }
  };

  // Shopping list statistics
  const stats = useMemo(() => {
    if (!shoppingLists || shoppingLists.length === 0) {
      return {
        totalLists: 0,
        completedLists: 0,
        totalItems: 0,
        totalPurchased: 0,
        totalEstimatedCost: 0,
        totalBudget: 0,
      };
    }

    const totalLists = shoppingLists.length;
    const completedLists = shoppingLists.filter(list => list.isCompleted).length;
    const totalItems = shoppingLists.reduce((sum, list) => sum + (list.totalItems || 0), 0);
    const totalPurchased = shoppingLists.reduce((sum, list) => sum + (list.completedItems || 0), 0);
    const totalEstimatedCost = shoppingLists.reduce((sum, list) => sum + (list.estimatedTotal || 0), 0);
    const totalBudget = shoppingLists.reduce((sum, list) => sum + (list.budgetAmount || 0), 0);

    return {
      totalLists,
      completedLists,
      totalItems,
      totalPurchased,
      totalEstimatedCost,
      totalBudget,
    };
  }, [shoppingLists]);

  // Enhanced refetch that updates both Apollo and MMKV cache
  const refetch = async () => {
    if (isLoggedOut || isLoggingOut) return;
    
    const result = await networkRefetch();
    if (result.data?.shoppingLists) {
      shoppingListStorage.setShoppingLists(result.data.shoppingLists, user?.id);
      setOptimisticLists(result.data.shoppingLists);
    }
    return result;
  };

  return {
    // Data
    lists: filteredLists,
    allLists: shoppingLists,
    loading: isInitialLoading,
    refreshing: isRefreshing,
    error,
    stats,

    // Search
    searchQuery,
    setSearchQuery,

    // Loading states
    creating,
    updating,
    deleting,
    addingItem,
    updatingItem,
    removingItem,
    markingPurchased,

    // Cache info for debugging
    hasLoadedCache,
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
    getListById: (listId: string) => shoppingLists.find(list => list.id === listId),
    getDefaultList: () => shoppingLists.find(list => list.isDefault),
    getCompletedLists: () => shoppingLists.filter(list => list.isCompleted),
    getActiveLists: () => shoppingLists.filter(list => !list.isCompleted),
  };
}
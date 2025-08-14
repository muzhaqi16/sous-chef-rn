import {useMemo} from 'react';
import {Alert} from 'react-native';
import {
  useGetPantryItemsQuery,
  usePantryItemsChangedSubscription,
  useAddItemToPantryMutation,
  useUpdatePantryItemMutation,
  useRemoveItemFromPantryMutation,
  useGetPantryItemQuery,
  GetPantryItemsQuery,
  GetPantryItemsDocument,
  StorageState,
} from '#generated';
import {useSearchableList} from '../useSearchableList';
import {ApolloClient} from '@apollo/client';

export interface PantryItemInput {
  itemName: string;
  brand?: string;
  quantity: number;
  unit?: string;
  unitId?: string;
  minimumQuantity?: number;
  storageState: StorageState;
  location?: string;
  expirationDate?: string;
  notes?: string;
  category?: string;
  barcode?: string;
  imageUrl?: string;
}

export interface PantryItemUpdate extends Partial<PantryItemInput> {
  currentQuantity?: number;
}

export function usePantryManagement(pantryId: string | undefined) {
  // Fetch pantry items with real-time updates
  const {data, loading, error, refetch} = useGetPantryItemsQuery({
    fetchPolicy: 'cache-and-network',
    skip: !pantryId,
    variables: {pantryId: pantryId ?? ''},
  });

  // Subscribe to pantry item changes
  usePantryItemsChangedSubscription({
    variables: {pantryId: pantryId ?? ''},
    skip: !pantryId,
    onData: ({
      data: subData,
      client,
    }: {
      data: any;
      client: ApolloClient<any>;
    }) => {
      const updatedItem = subData?.data?.pantryItemUpdated;
      if (!updatedItem) return;

      const cache = client.readQuery<GetPantryItemsQuery>({
        query: GetPantryItemsDocument,
        variables: {pantryId},
      });

      if (!cache?.pantryItems) return;

      const exists = cache.pantryItems.some(i => i.id === updatedItem.id);
      const updated = exists
        ? cache.pantryItems.map(i =>
            i.id === updatedItem.id ? updatedItem : i,
          )
        : [...cache.pantryItems, updatedItem];

      client.writeQuery<GetPantryItemsQuery>({
        query: GetPantryItemsDocument,
        variables: {pantryId},
        data: {pantryItems: updated},
      });
    },
  });

  const pantryItems = data?.pantryItems || [];

  // Simple search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(pantryItems, (item, q) => {
    const searchTerm = q.toLowerCase();
    return item?.item?.name?.toLowerCase().includes(searchTerm);
  });

  // Add item mutation
  const [addItemMutation, {loading: adding}] = useAddItemToPantryMutation({
    update: (cache, {data}) => {
      if (data?.addItemToPantry && pantryId) {
        const existingItems = cache.readQuery<GetPantryItemsQuery>({
          query: GetPantryItemsDocument,
          variables: {pantryId},
        });

        if (existingItems?.pantryItems) {
          cache.writeQuery<GetPantryItemsQuery>({
            query: GetPantryItemsDocument,
            variables: {pantryId},
            data: {
              pantryItems: [...existingItems.pantryItems, data.addItemToPantry],
            },
          });
        }
      }
    },
    onError: error => {
      Alert.alert('Error', 'Failed to add item to pantry');
      console.error('Add pantry item error:', error);
    },
  });

  // Update item mutation
  const [updateItemMutation, {loading: updating}] = useUpdatePantryItemMutation(
    {
      update: (cache, {data}) => {
        if (data?.updatePantryItem && pantryId) {
          const existingItems = cache.readQuery<GetPantryItemsQuery>({
            query: GetPantryItemsDocument,
            variables: {pantryId},
          });

          if (existingItems?.pantryItems) {
            const updatedItems = existingItems.pantryItems.map(item =>
              item.id === data.updatePantryItem.id
                ? data.updatePantryItem
                : item,
            );

            cache.writeQuery<GetPantryItemsQuery>({
              query: GetPantryItemsDocument,
              variables: {pantryId},
              data: {
                pantryItems: updatedItems,
              },
            });
          }
        }
      },
      onError: error => {
        Alert.alert('Error', 'Failed to update item');
        console.error('Update pantry item error:', error);
      },
    },
  );

  // Remove item mutation
  const [removeItemMutation, {loading: removing}] =
    useRemoveItemFromPantryMutation({
      update: (cache, {data}) => {
        if (data?.removeItemFromPantry && pantryId) {
          const existingItems = cache.readQuery<GetPantryItemsQuery>({
            query: GetPantryItemsDocument,
            variables: {pantryId},
          });

          if (existingItems?.pantryItems) {
            const filteredItems = existingItems.pantryItems.filter(
              item => item.id !== data.removeItemFromPantry.id,
            );

            cache.writeQuery<GetPantryItemsQuery>({
              query: GetPantryItemsDocument,
              variables: {pantryId},
              data: {
                pantryItems: filteredItems,
              },
            });
          }
        }
      },
      onError: error => {
        Alert.alert('Error', 'Failed to remove item');
        console.error('Remove pantry item error:', error);
      },
    });

  // Helper functions
  const addItem = async (input: PantryItemInput) => {
    if (!pantryId) {
      Alert.alert('Error', 'No pantry selected');
      return false;
    }

    try {
      const result = await addItemMutation({
        variables: {
          input: {
            pantryId,
            initialQuantity: input.quantity,
            ...input,
          },
        },
      });

      if (result.data?.addItemToPantry) {
        return result.data.addItemToPantry;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    try {
      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: updates,
        },
      });

      if (result.data?.updatePantryItem) {
        return result.data.updatePantryItem;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const removeItem = async (itemId: string) => {
    return new Promise<boolean>(resolve => {
      Alert.alert(
        'Remove Item',
        'Are you sure you want to remove this item from your pantry?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeItemMutation({
                  variables: {id: itemId},
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

  const removeItemWithoutConfirmation = async (itemId: string) => {
    try {
      await removeItemMutation({
        variables: {id: itemId},
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  // Basic statistics (core pantry stats only)
  const stats = useMemo(() => {
    if (!pantryItems || pantryItems.length === 0) {
      return {
        total: 0,
        expired: 0,
        expiringSoon: 0,
        lowStock: 0,
        byStorageState: {},
      };
    }

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expired = pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt) < now;
    }).length;

    const expiringSoon = pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      const expirationDate = new Date(item.expiresAt);
      return expirationDate >= now && expirationDate <= sevenDaysFromNow;
    }).length;

    const lowStock = pantryItems.filter(item => {
      if (!item.currentQuantity || !item.reservedQuantity) return false;
      return item.currentQuantity <= item.reservedQuantity;
    }).length;

    // Group by storage state
    const byStorageState = pantryItems.reduce(
      (acc, item) => {
        const state = item.storageState || 'Unknown';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: pantryItems.length,
      expired,
      expiringSoon,
      lowStock,
      byStorageState,
    };
  }, [pantryItems]);

  // Simple filtered lists
  const getItemsByStorageState = (storageState: StorageState) => {
    return pantryItems.filter(item => item.storageState === storageState);
  };

  const getExpiringItems = (days: number = 7) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      const expirationDate = new Date(item.expiresAt);
      return expirationDate <= futureDate;
    });
  };

  const getLowStockItems = () => {
    return pantryItems.filter(item => {
      if (!item.currentQuantity || !item.reservedQuantity) return false;
      return item.currentQuantity <= item.reservedQuantity;
    });
  };

  const getExpiredItems = () => {
    const now = new Date();
    return pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt) < now;
    });
  };

  return {
    // Data
    items: filteredItems,
    allItems: pantryItems,
    loading,
    error,
    stats,

    // Search
    searchQuery,
    setSearchQuery,

    // Loading states
    adding,
    updating,
    removing,

    // Actions
    addItem,
    updateItem,
    removeItem,
    removeItemWithoutConfirmation,
    refetch,

    // Simple filtered data helpers
    getItemsByStorageState,
    getExpiringItems,
    getLowStockItems,
    getExpiredItems,
  };
}

// Single pantry item hook (unchanged)
export function usePantryItem(itemId: string | undefined) {
  const {data, loading, error, refetch} = useGetPantryItemQuery({
    variables: {id: itemId ?? ''},
    skip: !itemId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    item: data?.pantryItem,
    loading,
    error,
    refetch,
  };
}

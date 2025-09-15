import {useMemo, useState, useEffect} from 'react';
import {Alert} from 'react-native';
import {
  useGetPantryItemsQuery,
  usePantryItemsChangedSubscription,
  useAddItemToPantryMutation,
  useUpdatePantryItemMutation,
  useRemoveItemFromPantryMutation,
  StorageState,
} from '#generated';
import {useSearchableList} from '../useSearchableList';
import {pantryStorage} from '#/storage/pantryCache';
import {useStore} from '#store';

export interface PantryItemInput {
  itemName: string;
  brand?: string;
  quantity: number;
  unit?: string;
  unitId: string;
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
  // Get user state to check for logout
  const user = useStore(state => state.user);
  const isLoggedOut = !user;
  const addNotification = useStore(state => state.addNotification);
  // Local state - MMKV is source of truth
  const [items, setItems] = useState<any[]>([]);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  // Load from MMKV immediately when pantryId changes
  useEffect(() => {
    if (pantryId && !isLoggedOut) {
      const cached = pantryStorage.getPantryItems(pantryId);
      if (cached && cached.length > 0) {
        console.log('📦 Loaded', cached.length, 'items from MMKV cache');
        setItems(cached);
        setHasLoadedCache(true);
      } else {
        setItems([]);
        setHasLoadedCache(false);
      }
    } else {
      setItems([]);
      setHasLoadedCache(false);
    }
  }, [pantryId, isLoggedOut]);

  // Simple query - always fetch fresh, no Apollo cache complexity
  const {refetch: networkRefetch, loading} = useGetPantryItemsQuery({
    variables: {pantryId: pantryId ?? ''},
    skip: !pantryId || isLoggedOut,
    fetchPolicy: 'network-only', // Always fetch fresh
    notifyOnNetworkStatusChange: true,
    onCompleted: data => {
      if (data?.pantryItems && pantryId) {
        console.log(
          '🌐 Received',
          data.pantryItems.length,
          'items from network',
        );
        // Update MMKV (source of truth)
        pantryStorage.setPantryItems(pantryId, data.pantryItems);
        // Update local state
        setItems(data.pantryItems);
      }
    },
    onError: error => {
      console.warn('Network query failed, using cached data:', error.message);
      // We already have MMKV cache loaded, so no need to do anything
    },
  });

  // Simple subscription - just triggers refetch
  usePantryItemsChangedSubscription({
    variables: {pantryId: pantryId ?? ''},
    skip: !pantryId || isLoggedOut,
    onData: ({data: subData}) => {
      const changeData = subData?.data?.pantryItemsChanged;
      if (!changeData) return;

      console.log(
        '🔔 Subscription:',
        changeData.mutation,
        'for item',
        changeData.item?.id,
      );

      // Don't try to merge - just refetch the full list
      // This ensures we always have complete data
      networkRefetch();
    },
    onError: error => {
      console.warn('Subscription error:', error.message);
    },
  });

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(items, (item, q) => {
    const searchTerm = q.toLowerCase();
    return (
      item?.item?.name?.toLowerCase().includes(searchTerm) ||
      item?.itemName?.toLowerCase().includes(searchTerm)
    );
  });

  // Simple stats
  const stats = useMemo(() => {
    if (!items || items.length === 0) {
      return {
        total: 0,
        expired: 0,
        expiringSoon: 0,
        lowStock: 0,
      };
    }

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expired = items.filter(item => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt) < now;
    }).length;

    const expiringSoon = items.filter(item => {
      if (!item.expiresAt) return false;
      const expirationDate = new Date(item.expiresAt);
      return expirationDate >= now && expirationDate <= sevenDaysFromNow;
    }).length;

    const lowStock = items.filter(item => {
      if (!item.currentQuantity || !item.minimumQuantity) return false;
      return item.currentQuantity <= item.minimumQuantity;
    }).length;

    return {
      total: items.length,
      expired,
      expiringSoon,
      lowStock,
    };
  }, [items]);

  // Mutations with optimistic updates
  const [addItemMutation] = useAddItemToPantryMutation();
  const [updateItemMutation] = useUpdatePantryItemMutation();
  const [removeItemMutation] = useRemoveItemFromPantryMutation();

  // Add item with optimistic update
  const addItem = async (input: PantryItemInput) => {
    if (!pantryId) return false;

    // Optimistically update MMKV and UI
    const optimisticItem = {
      id: `temp-${Date.now()}`,
      ...input,
      pantryId,
      currentQuantity: input.quantity,
      initialQuantity: input.quantity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      item: {
        id: `temp-item-${Date.now()}`,
        name: input.itemName,
        __typename: 'Item',
      },
      __typename: 'PantryItem',
    };

    const currentItems = items;
    const newItems = [...currentItems, optimisticItem];
    pantryStorage.setPantryItems(pantryId, newItems);
    setItems(newItems);

    try {
      const result = await addItemMutation({
        variables: {
          input: {
            pantryId,
            initialQuantity: input.quantity,
            itemName: input.itemName,
            unitId: input.unitId,
            storageState: input.storageState,
            ...(input.brand && {itemBrand: input.brand}),
            ...(input.location && {storageLocation: input.location}),
            ...(input.expirationDate && {expiresAt: input.expirationDate}),
            ...(input.notes && {storageNotes: input.notes}),
            ...(input.category && {itemCategory: input.category}),
            ...(input.barcode && {itemUpc: input.barcode}),
          },
        },
      });

      if (result.data?.addItemToPantry) {
        // Refetch to get complete data
        await networkRefetch();
        return result.data.addItemToPantry;
      }
    } catch (error) {
      // Rollback on error
      pantryStorage.setPantryItems(pantryId, currentItems);
      setItems(currentItems);
      console.error('Add item error:', error);
      Alert.alert('Error', 'Failed to add item');
    }

    return false;
  };

  // Update item
  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    if (!pantryId) return false;

    // Optimistic update
    const currentItems = items;
    const updatedItems = currentItems.map(item =>
      item.id === itemId ? {...item, ...updates} : item,
    );
    pantryStorage.setPantryItems(pantryId, updatedItems);
    setItems(updatedItems);

    try {
      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: updates,
        },
      });

      if (result.data?.updatePantryItem) {
        // Refetch to get complete updated data
        await networkRefetch();
        return result.data.updatePantryItem;
      }
    } catch (error) {
      // Rollback on error
      pantryStorage.setPantryItems(pantryId, currentItems);
      setItems(currentItems);
      console.error('Update item error:', error);
      Alert.alert('Error', 'Failed to update item');
    }

    return false;
  };

  // Remove item
  const removeItem = async (itemId: string) => {
    if (!pantryId) return false;

    // Optimistic update
    const currentItems = items;
    const filteredItems = currentItems.filter(item => item.id !== itemId);
    pantryStorage.setPantryItems(pantryId, filteredItems);
    setItems(filteredItems);

    try {
      await removeItemMutation({
        variables: {id: itemId},
      });

      // Refetch to ensure consistency
      await networkRefetch();
      return true;
    } catch (error) {
      // Rollback on error
      pantryStorage.setPantryItems(pantryId, currentItems);
      setItems(currentItems);
      console.error('Remove item error:', error);
      Alert.alert('Error', 'Failed to remove item');
      return false;
    }
  };

  // Enhanced refetch
  const refetch = async () => {
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
    items: filteredItems,
    allItems: items,
    loading,
    hasLoadedCache,
    stats,

    // Search
    searchQuery,
    setSearchQuery,

    // Actions
    addItem,
    updateItem,
    removeItem,
    refetch,

    // Cache debugging
    cacheInfo: pantryId ? pantryStorage.getCacheInfo(pantryId) : null,

    // Helper functions
    getItemById: (itemId: string) => items.find(item => item.id === itemId),
    getItemsByStorageState: (storageState: StorageState) =>
      items.filter(item => item.storageState === storageState),
    getExpiringItems: (days: number = 7) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      return items.filter(item => {
        if (!item.expiresAt) return false;
        const expirationDate = new Date(item.expiresAt);
        return expirationDate <= futureDate;
      });
    },
    getLowStockItems: () =>
      items.filter(item => {
        if (!item.currentQuantity || !item.minimumQuantity) return false;
        return item.currentQuantity <= item.minimumQuantity;
      }),
    getExpiredItems: () => {
      const now = new Date();
      return items.filter(item => {
        if (!item.expiresAt) return false;
        return new Date(item.expiresAt) < now;
      });
    },
  };
}

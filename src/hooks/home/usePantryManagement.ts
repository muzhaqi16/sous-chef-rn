import { useMemo } from 'react';
import { Alert } from 'react-native';
import {
  useGetPantryItemsQuery,
  usePantryItemsChangedSubscription,
  useAddItemToPantryMutation,
  useUpdatePantryItemMutation,
  useRemoveItemFromPantryMutation,
  StorageState,
  PantryItemFragment,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useAuth } from '#hooks/auth/useAuth';

export interface PantryItemInput {
  itemName: string;
  brand?: string;
  quantity: number;
  unit?: string;
  unitId: string;
  autoReorderPoint?: number;
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

/**
 * Simplified pantry management hook using Apollo Client only
 * No custom caches, no complex state management - just Apollo
 */
export function usePantryManagement(pantryId: string | undefined) {
  const { isLoggedOut } = useAuth();
  const shouldSkip = !pantryId || isLoggedOut;

  // Single source of truth: Apollo cache with network-first for freshness
  const {
    data,
    loading,
    error,
    refetch,
  } = useGetPantryItemsQuery({
    variables: { pantryId: pantryId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network', // Always try network for fresh data
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  // Real-time updates via subscription
  usePantryItemsChangedSubscription({
    variables: { pantryId: pantryId ?? '' },
    skip: shouldSkip,
    onData: () => {
      // Apollo cache is automatically updated by subscription
      // No manual refetch needed - just let cache work
    },
    onError: (error) => {
      console.warn('Pantry subscription error:', error.message);
      // Fallback: refetch on subscription error
      refetch();
    },
  });

  const items = data?.pantryItems ?? [];

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

  // Simple stats calculation
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
      if (!item.currentQuantity || !item.autoReorderPoint) return false;
      return item.currentQuantity <= item.autoReorderPoint;
    }).length;

    return {
      total: items.length,
      expired,
      expiringSoon,
      lowStock,
    };
  }, [items]);

  // Mutations with Apollo's optimistic updates
  const [addItemMutation] = useAddItemToPantryMutation({
    errorPolicy: 'all',
    onError: (error) => {
      console.error('Add item error:', error);
      Alert.alert('Error', 'Failed to add item');
    },
  });

  const [updateItemMutation] = useUpdatePantryItemMutation({
    errorPolicy: 'all',
    onError: (error) => {
      console.error('Update item error:', error);
      Alert.alert('Error', 'Failed to update item');
    },
  });

  const [removeItemMutation] = useRemoveItemFromPantryMutation({
    errorPolicy: 'all',
    onError: (error) => {
      console.error('Remove item error:', error);
      Alert.alert('Error', 'Failed to remove item');
    },
  });

  // Simplified add item - let Apollo handle optimistic updates
  const addItem = async (input: PantryItemInput) => {
    if (!pantryId) return false;

    try {
      const result = await addItemMutation({
        variables: {
          input: {
            pantryId,
            initialQuantity: input.quantity,
            itemName: input.itemName,
            unitId: input.unitId,
            storageState: input.storageState,
            ...(input.brand && { itemBrand: input.brand }),
            ...(input.location && { storageLocation: input.location }),
            ...(input.expirationDate && { expiresAt: input.expirationDate }),
            ...(input.notes && { storageNotes: input.notes }),
            ...(input.category && { itemCategory: input.category }),
            ...(input.barcode && { itemUpc: input.barcode }),
          },
        },
        // Apollo will handle cache updates automatically
        refetchQueries: ['GetPantryItems'],
      });

      return result.data?.addItemToPantry ?? false;
    } catch (error) {
      console.error('Add item error:', error);
      return false;
    }
  };

  // Simplified update item
  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    if (!pantryId) return false;

    try {
      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: updates,
        },
        refetchQueries: ['GetPantryItems'],
      });

      return result.data?.updatePantryItem ?? false;
    } catch (error) {
      console.error('Update item error:', error);
      return false;
    }
  };

  // Simplified remove item
  const removeItem = async (itemId: string) => {
    if (!pantryId) return false;

    try {
      await removeItemMutation({
        variables: { id: itemId },
        refetchQueries: ['GetPantryItems'],
      });

      return true;
    } catch (error) {
      console.error('Remove item error:', error);
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
    refetch,

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
        if (!item.currentQuantity || !item.autoReorderPoint) return false;
        return item.currentQuantity <= item.autoReorderPoint;
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
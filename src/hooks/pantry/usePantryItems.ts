import { useMemo } from 'react';
import {
  useGetPantryItemsQuery,
  usePantryItemsChangedSubscription,
  StorageState,
} from '#generated';
import { useSearchableList } from '../useSearchableList';
import { useErrorHandler } from '#/utils/errorHandling';
import { useAuth } from '#hooks/auth/useAuth';

export function usePantryItems(pantryId: string | undefined) {
  const { handleApolloError } = useErrorHandler();
  const { isLoggedOut } = useAuth();
  const shouldSkip = !pantryId || isLoggedOut;

  const { data, loading, error, refetch } = useGetPantryItemsQuery({
    fetchPolicy: 'cache-and-network', // Always check network for fresh data after token refresh
    skip: shouldSkip,
    variables: { pantryId: pantryId ?? '' },
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all', // Allow partial data and cache on errors
  });

  usePantryItemsChangedSubscription({
    variables: { pantryId: pantryId ?? '' },
    skip: shouldSkip,
    onData: () => {
      // Apollo cache is automatically updated by subscription
      // No manual cache manipulation needed - just let Apollo work
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Pantry Subscription',
      });
      console.warn('Pantry subscription error:', message);
      // Don't refetch on subscription errors - let the query handle reconnection
    },
  });

  const pantryItems = useMemo(
    () => data?.pantryItems ?? [],
    [data?.pantryItems],
  );

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(pantryItems, (item, q) => {
    const searchTerm = q.toLowerCase();
    return (
      item?.item?.name?.toLowerCase().includes(searchTerm) ||
      item?.itemName?.toLowerCase().includes(searchTerm)
    );
  });

  // Simple stats calculation
  const stats = useMemo(() => {
    if (!pantryItems || pantryItems.length === 0) {
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
      if (!item.currentQuantity || !item.autoReorderPoint) return false;
      return item.currentQuantity <= item.autoReorderPoint;
    }).length;

    return {
      total: pantryItems.length,
      expired,
      expiringSoon,
      lowStock,
    };
  }, [pantryItems]);

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

    // Actions
    refetch,

    // Helper functions
    getItemById: (itemId: string) =>
      pantryItems.find(item => item.id === itemId),
    getItemsByStorageState: (storageState: StorageState) =>
      pantryItems.filter(item => item.storageState === storageState),
    getExpiringItems: (days: number = 7) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      return pantryItems.filter(item => {
        if (!item.expiresAt) return false;
        const expirationDate = new Date(item.expiresAt);
        return expirationDate <= futureDate;
      });
    },
    getLowStockItems: () =>
      pantryItems.filter(item => {
        if (!item.currentQuantity || !item.autoReorderPoint) return false;
        return item.currentQuantity <= item.autoReorderPoint;
      }),
    getExpiredItems: () => {
      const now = new Date();
      return pantryItems.filter(item => {
        if (!item.expiresAt) return false;
        return new Date(item.expiresAt) < now;
      });
    },
  };
}

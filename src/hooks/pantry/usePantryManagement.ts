import { StorageState } from '#generated';
import { useSearchableList } from '../useSearchableList';
import { pantryItemSearch } from '#/utils/searchUtils';
import { usePantryQuery } from './usePantryQuery';
import { usePantryMutations } from './usePantryMutations';
import { usePantryStats } from './usePantryStats';
import { usePantryPagination } from './usePantryPagination';

/**
 * Main pantry management hook - Facade pattern
 * Composes query, mutations, stats, pagination, and search functionality
 * Maintains backward compatibility with original API
 */
export function usePantryManagement(pantryId: string | undefined) {
  // Query for pantry items
  const { items, pageInfo, loading, error, refetch, fetchMore } = usePantryQuery(pantryId);

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(items, pantryItemSearch);

  // Stats calculation
  const stats = usePantryStats(items);

  // Pagination
  const { hasMore, loadMore, isLoadingMore } = usePantryPagination({
    pantryId,
    pageInfo,
    loading,
    itemCount: items.length,
    fetchMore,
  });

  // CRUD mutations
  const { addItem, updateItem, removeItem } = usePantryMutations({
    pantryId,
    items,
    refetch,
  });

  return {
    // Data
    items: filteredItems,
    allItems: items,
    loading,
    error,
    stats,

    // Pagination
    loadMore,
    hasMore,
    isLoadingMore,

    // Search
    searchQuery,
    setSearchQuery,

    // Actions
    addItem,
    updateItem,
    removeItem,
    refetch,

    // Helper functions
    getItemById: (itemId: string) =>
      items.find(item => item.id === itemId),
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

// Re-export types for convenience
export type { PantryItemInput, PantryItemUpdate } from './usePantryMutations';

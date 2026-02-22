/**
 * usePantryManagement - Composition hook for all pantry operations
 *
 * For new code, prefer using individual hooks directly:
 * - usePantryQuery: For data fetching and search
 * - usePantryStats: For location counts and sectioned items
 * - usePantryItemMutations: For CRUD operations
 *
 * @example
 * ```tsx
 * const { pantryItems, searchQuery, setSearchQuery } = usePantryQuery(pantryId);
 * const { locationCounts, sectionedItems } = usePantryStats(pantryItems);
 * ```
 */

import { usePantryQuery } from './usePantryQuery';
import { usePantryStats } from './usePantryStats';
import { usePantryItemMutations } from './usePantryItemMutations';

export function usePantryManagement(pantryId: string | undefined) {
  // Query hook - fetches pantry data
  const {
    pantryItems,
    filteredItems,
    stats,
    totalCount,
    loading,
    isRefreshing,
    error,
    refetch,
    hasMore,
    loadMore,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
  } = usePantryQuery(pantryId);

  // Stats hook - computes location counts
  const { locationCounts } = usePantryStats(pantryItems, totalCount);

  // Mutations hook - CRUD operations
  const { addItem, updateItem, removeItem } = usePantryItemMutations({
    pantryId,
    pantryItems,
    refetch,
  });

  return {
    // Data
    items: filteredItems,
    allItems: pantryItems,
    stats,
    totalCount,
    loading,
    isRefreshing,
    error,

    // Redesign data
    locationCounts,

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
  };
}

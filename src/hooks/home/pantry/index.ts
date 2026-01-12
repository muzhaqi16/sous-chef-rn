/**
 * Pantry Management Hooks
 *
 * Split into focused, single-responsibility hooks:
 * - usePantryQuery: Fetch pantry data with pagination
 * - usePantryStats: Compute statistics and derived data
 * - usePantryItemMutations: CRUD operations
 *
 * This index provides both:
 * 1. Individual hooks for fine-grained usage
 * 2. Composition hook for backward compatibility
 */

// Individual hooks
export { usePantryQuery } from './usePantryQuery';
export { usePantryStats } from './usePantryStats';
export { usePantryItemMutations } from './usePantryItemMutations';

// Types
export type {
  PantryItemInput,
  PantryItemUpdate,
  PantryStats,
  LocationCounts,
  SectionedItems,
} from './types';

// Re-export StorageState for convenience
export { StorageState } from '#generated';

// ============================================================
// Composition hook - backward compatible with usePantryManagement
// ============================================================

import { usePantryQuery } from './usePantryQuery';
import { usePantryStats } from './usePantryStats';
import { usePantryItemMutations } from './usePantryItemMutations';

/**
 * usePantryManagement - Composition hook for all pantry operations
 *
 * This maintains backward compatibility with the original hook.
 * For new code, prefer using individual hooks directly:
 * - usePantryQuery: For data fetching and search
 * - usePantryStats: For statistics and filtering
 * - usePantryItemMutations: For CRUD operations
 *
 * @example
 * ```tsx
 * // Backward compatible usage
 * const { items, addItem, stats, loadMore } = usePantryManagement(pantryId);
 *
 * // Preferred: Use individual hooks
 * const { pantryItems, searchQuery, setSearchQuery } = usePantryQuery(pantryId);
 * const { stats, locationCounts } = usePantryStats(pantryItems);
 * ```
 */
export function usePantryManagement(pantryId: string | undefined) {
  // Query hook - fetches pantry data
  const {
    pantryItems,
    filteredItems,
    loading,
    networkStatus,
    error,
    refetch,
    hasMore,
    loadMore,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
  } = usePantryQuery(pantryId);

  // Stats hook - computes statistics and sections
  const {
    stats,
    locationCounts,
    sectionedItems,
    getItemById,
    getItemsByStorageState,
    getExpiringItems,
    getLowStockItems,
    getExpiredItems,
  } = usePantryStats(pantryItems);

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
    loading,
    networkStatus,
    error,
    stats,

    // Redesign data
    locationCounts,
    sectionedItems,

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
    getItemById,
    getItemsByStorageState,
    getExpiringItems,
    getLowStockItems,
    getExpiredItems,
  };
}

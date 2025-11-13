import { useCallback } from 'react';
import { useSearchableList } from '../useSearchableList';
import { shoppingListItemSearch } from '#/utils/searchUtils';
import { useShoppingListQuery } from './useShoppingListQuery';
import { useShoppingListMutations } from './useShoppingListMutations';
import { useShoppingListStats } from './useShoppingListStats';

/**
 * Main shopping list management hook - Facade pattern
 * Composes query, mutations, stats, and search functionality
 * Maintains backward compatibility with original API
 */
export function useShoppingListManagement(listId: string | undefined) {
  // Query for shopping list items
  const { items, loading, error, refetch } = useShoppingListQuery(listId);

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(items, shoppingListItemSearch);

  // Stats calculation
  const stats = useShoppingListStats(items);

  // CRUD mutations
  const { addItem, updateItem, removeItem, toggleItem } = useShoppingListMutations({
    listId,
    items,
    refetch,
  });

  // Pagination helpers (shoppingListItems returns full list; no pagination)
  const loadMore = useCallback(async () => {
    return;
  }, []);
  const hasMore = false;

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
    isLoadingMore: loading && items.length > 0,

    // Search
    searchQuery,
    setSearchQuery,

    // Actions
    addItem,
    updateItem,
    removeItem,
    toggleItem,
    refetch,

    // Helper functions
    getItemById: (itemId: string) => items.find(item => item.id === itemId),
    getCompletedItems: () => items.filter(item => item.isPurchased),
    getPendingItems: () => items.filter(item => !item.isPurchased),
    getItemsByCategory: (category: string) =>
      items.filter(item => item.category === category),
  };
}

// Re-export types for convenience
export type { ShoppingListItemInput, ShoppingListItemUpdate } from './useShoppingListMutations';

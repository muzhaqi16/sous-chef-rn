import { useMemo, useCallback } from 'react';
import { useSearchableList } from '../useSearchableList';
import { shoppingListItemSearch } from '#/utils/searchUtils';
import { useShoppingListItemsQuery } from './useShoppingListItemsQuery';
import { useShoppingListItemMutations } from './useShoppingListItemMutations';
import type { ShoppingListItemInput, ShoppingListItemUpdate } from './useShoppingListItemMutations';

// Re-export types for consumers
export type { ShoppingListItemInput, ShoppingListItemUpdate };

/**
 * useShoppingListManagement - Composition hook for shopping list data management
 *
 * Orchestrates specialized hooks:
 * 1. useShoppingListItemsQuery - Fetch items AND shopping list details
 * 2. useShoppingListItemMutations - CRUD operations with optimistic responses
 * 3. useSearchableList - Client-side search filtering
 *
 * Returns:
 * - items: Sorted shopping list items
 * - shoppingList: Full shopping list details (for permissions, collaborators)
 * - mutations: addItem, updateItem, removeItem, toggleItem
 * - search: query, setQuery, filtered items
 *
 * @param currentListId - Validated list ID from useShoppingListSelection
 *   (ensures the ID exists in available lists, preventing queries for deleted lists)
 */
export function useShoppingListManagement(currentListId: string | undefined) {
  // 1. Query: Fetch items AND shopping list details (for permissions)
  const { items, shoppingList, loading, error, refetch } = useShoppingListItemsQuery(currentListId);

  // 2. Mutations: CRUD operations
  const { addItem, updateItem, removeItem, toggleItem } = useShoppingListItemMutations(
    currentListId,
    items,
    refetch,
  );

  // 3. Search: Client-side filtering
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(items, shoppingListItemSearch);

  // Stats calculation
  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter(item => item?.purchaseInfo?.isPurchased).length;
    const pending = total - completed;

    return {
      total,
      completed,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [items]);

  // Pagination helpers (shoppingListItems returns full list; no pagination)
  const loadMore = useCallback(async () => {
    return;
  }, []);
  const hasMore = false;

  // Helper functions
  const getItemById = useCallback(
    (itemId: string) => items.find(item => item.id === itemId),
    [items],
  );

  const getCompletedItems = useCallback(
    () => items.filter(item => item.purchaseInfo?.isPurchased),
    [items],
  );

  const getPendingItems = useCallback(
    () => items.filter(item => !item.purchaseInfo?.isPurchased),
    [items],
  );

  const getItemsByCategory = useCallback(
    (category: string) => items.filter(item => item.category === category),
    [items],
  );

  return {
    // Data
    items: filteredItems,
    allItems: items,
    shoppingList, // Full shopping list details for permissions, collaborators
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
    getItemById,
    getCompletedItems,
    getPendingItems,
    getItemsByCategory,
  };
}

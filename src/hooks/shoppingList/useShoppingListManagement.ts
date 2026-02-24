import { useMemo, useCallback } from 'react';
import { useSearchableList } from '../useSearchableList';
import { shoppingListItemSearch } from '#/utils/searchUtils';
import { useShoppingListItemsQuery } from './useShoppingListItemsQuery';
import { usePaginatedShoppingItems } from './usePaginatedShoppingItems';
import { useShoppingListItemMutations } from './mutations/useShoppingListItemMutations';

/**
 * useShoppingListManagement - Composition hook for shopping list data management
 *
 * Orchestrates specialized hooks:
 * 1. useShoppingListItemsQuery - Fetch shopping list details (for permissions)
 * 2. usePaginatedShoppingItems - Single query fetches BOTH unpurchased/purchased items
 * 3. useShoppingListItemMutations - CRUD operations with optimistic responses
 * 4. useSearchableList - Client-side search filtering
 *
 * Returns:
 * - items: Sorted shopping list items (combined)
 * - unpurchasedItems: Paginated unpurchased items for Shopping tab
 * - purchasedItems: Paginated purchased items for Purchased tab
 * - shoppingList: Full shopping list details (for permissions, collaborators)
 * - mutations: addItem, updateItem, removeItem, toggleItem
 * - search: query, setQuery, filtered items
 * - pagination: loadMore, hasMore, isLoadingMore (per tab)
 *
 * @param currentListId - Validated list ID from useShoppingListSelection
 *   (ensures the ID exists in available lists, preventing queries for deleted lists)
 */
export function useShoppingListManagement(currentListId: string | undefined) {
  // 1. Query shopping list details (for permissions, collaborators)
  const { shoppingList, error: listError } = useShoppingListItemsQuery(currentListId);

  // 2. Single query fetches BOTH unpurchased and purchased items (no cache collision)
  const {
    unpurchased,
    purchased,
    loading: itemsLoading,
    error: itemsError,
    refetch,
    isTransitioning,
  } = usePaginatedShoppingItems({
    listId: currentListId,
  });

  // Extract data from combined query result
  const unpurchasedItems = unpurchased.items;
  const purchasedItems = purchased.items;
  const totalCountUnpurchased = unpurchased.totalCount;
  const totalCountPurchased = purchased.totalCount;

  // Combined items for backwards compatibility
  const items = useMemo(
    () => [...unpurchasedItems, ...purchasedItems],
    [unpurchasedItems, purchasedItems],
  );

  // Combined loading/error state
  const loading = itemsLoading;
  const error = listError || itemsError;

  // 3. Mutations: CRUD operations
  const { addItem, updateItem, removeItem, toggleItem } = useShoppingListItemMutations(
    currentListId,
    items,
    refetch,
  );

  // 4. Search: Client-side filtering
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(items, shoppingListItemSearch);

  // Filter unpurchased/purchased items by search query
  const filteredUnpurchasedItems = useMemo(() => {
    if (!searchQuery.trim()) return unpurchasedItems;
    return unpurchasedItems.filter(item =>
      shoppingListItemSearch(item, searchQuery),
    );
  }, [unpurchasedItems, searchQuery]);

  const filteredPurchasedItems = useMemo(() => {
    if (!searchQuery.trim()) return purchasedItems;
    return purchasedItems.filter(item =>
      shoppingListItemSearch(item, searchQuery),
    );
  }, [purchasedItems, searchQuery]);

  // Helper functions
  const getItemById = useCallback(
    (itemId: string) => items.find(item => item.id === itemId),
    [items],
  );

  const getCompletedItems = useCallback(() => purchasedItems, [purchasedItems]);

  const getPendingItems = useCallback(() => unpurchasedItems, [unpurchasedItems]);

  const getItemsByCategory = useCallback(
    (category: string) => items.filter(item => item.category === category),
    [items],
  );

  return {
    // Data
    items: filteredItems,
    allItems: items,
    unpurchasedItems: filteredUnpurchasedItems,
    purchasedItems: filteredPurchasedItems,
    shoppingList, // Full shopping list details for permissions, collaborators
    loading,
    error,
    isTransitioning,

    // Total counts for tab headers (from GraphQL totalCount, not array length)
    totalCountUnpurchased,
    totalCountPurchased,

    // Pagination - Shopping tab (unpurchased)
    loadMoreUnpurchased: unpurchased.loadMore,
    hasMoreUnpurchased: unpurchased.hasMore,
    isLoadingMoreUnpurchased: unpurchased.isLoadingMore,

    // Pagination - Purchased tab
    loadMorePurchased: purchased.loadMore,
    hasMorePurchased: purchased.hasMore,
    isLoadingMorePurchased: purchased.isLoadingMore,

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

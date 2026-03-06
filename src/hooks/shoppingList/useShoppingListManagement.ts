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
  // Fallback to completedItems from GetShoppingListDetails so the tab badge
  // shows immediately before the deferred purchased query completes
  const totalCountPurchased = purchased.totalCount || shoppingList?.completedItems || 0;

  // Combined items for backwards compatibility
  const items = [...unpurchasedItems, ...purchasedItems];

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
  const filteredUnpurchasedItems = !searchQuery.trim()
    ? unpurchasedItems
    : unpurchasedItems.filter(item =>
        shoppingListItemSearch(item, searchQuery),
      );

  const filteredPurchasedItems = !searchQuery.trim()
    ? purchasedItems
    : purchasedItems.filter(item =>
        shoppingListItemSearch(item, searchQuery),
      );

  // Helper functions
  const getItemById = (itemId: string) => items.find(item => item.id === itemId);

  const getCompletedItems = () => purchasedItems;

  const getPendingItems = () => unpurchasedItems;

  const getItemsByCategory = (category: string) => items.filter(item => item.category === category);

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

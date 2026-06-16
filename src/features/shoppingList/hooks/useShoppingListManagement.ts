import { useSearchableList } from '#hooks/useSearchableList';
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
  const {
    shoppingList,
    notFound: listNotFound,
    error: listError,
  } = useShoppingListItemsQuery(currentListId);

  // 2. Single query fetches BOTH unpurchased and purchased items (no cache collision)
  const {
    state: {
      unpurchased,
      purchased,
      loading: itemsLoading,
      error: itemsError,
      isTransitioning,
    },
    actions: { refetch },
  } = usePaginatedShoppingItems({
    listId: currentListId,
  });

  // Extract data from combined query result
  const unpurchasedItems = unpurchased.items;
  const purchasedItems = purchased.items;
  // Prefer entity-level counts from GetShoppingListDetails — they come from
  // `shoppingList.totalItems` / `shoppingList.completedItems` which are
  // server-authoritative and can't drift from the paginated connection's
  // `totalCount` (which reflects only the pages the client has fetched).
  const totalCountPurchased =
    purchased.totalCount ?? shoppingList?.completedItems ?? 0;
  const totalItemsEntity = shoppingList?.totalItems;
  const totalCountUnpurchased =
    unpurchased.totalCount ??
    (totalItemsEntity != null
      ? Math.max(0, totalItemsEntity - (shoppingList?.completedItems ?? 0))
      : 0);

  // Combined loading/error state
  const loading = itemsLoading;
  const error = listError || itemsError;

  // 3. Mutations: CRUD operations
  const { addItem, updateItem, removeItem, toggleItem } =
    useShoppingListItemMutations(currentListId, refetch);

  // 4. Search: Client-side filtering (only using query/setQuery for debounced state)
  const { query: searchQuery, setQuery: setSearchQuery } = useSearchableList(
    [],
    shoppingListItemSearch,
    { debounceMs: 300 },
  );

  // Filter unpurchased/purchased items by search query
  const filteredUnpurchasedItems = !searchQuery.trim()
    ? unpurchasedItems
    : unpurchasedItems.filter(item =>
        shoppingListItemSearch(item, searchQuery),
      );

  const filteredPurchasedItems = !searchQuery.trim()
    ? purchasedItems
    : purchasedItems.filter(item => shoppingListItemSearch(item, searchQuery));

  return {
    // Data
    unpurchasedItems: filteredUnpurchasedItems,
    purchasedItems: filteredPurchasedItems,
    // Raw (unfiltered) arrays for preloading/loading checks
    rawUnpurchasedItems: unpurchasedItems,
    rawPurchasedItems: purchasedItems,
    shoppingList, // Full shopping list details for permissions, collaborators
    listNotFound, // Server returned null for the list (deleted/unshared)
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
  };
}

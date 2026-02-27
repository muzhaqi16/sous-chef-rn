

import { useAuth } from '#/hooks/auth/useAuth';
import { isShoppingListOwner } from '#utils/ownershipHelpers';
import { useShoppingListsQuery } from './useShoppingListsQuery';
import { useShoppingListSelection } from './useShoppingListSelection';
import { useShoppingListTransformMulti } from './useShoppingListTransform';
import { useShoppingListManagement } from './useShoppingListManagement';

/**
 * useShoppingListScreen - Composition hook for the shopping list screen
 *
 * This is a facade that orchestrates specialized hooks:
 * 1. useShoppingListsQuery - Fetch all user's shopping lists (independent of home)
 * 2. useShoppingListSelection - Handle list selection and auto-select
 * 3. useShoppingListManagement - Manage items for current list (with pagination)
 * 4. useShoppingListTransform - Transform items for UI consumption
 *
 * Each composed hook has a single responsibility, making the code
 * easier to understand, test, and maintain.
 */
export function useShoppingListScreen() {
  const { user } = useAuth();

  // 1. Query: Fetch all user's shopping lists (independent of home)
  const { lists, loading: listsLoading } = useShoppingListsQuery();

  // 2. Selection: Determine current list with auto-select
  const {
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  } = useShoppingListSelection(lists);

  // 3. Items: Fetch and manage items for current list (with pagination)
  // Returns paginated unpurchasedItems and purchasedItems
  // PERF: Destructure all fields individually to enable useMemo on final return
  const {
    items,
    allItems,
    unpurchasedItems: rawUnpurchasedItems,
    purchasedItems: rawPurchasedItems,
    shoppingList: currentListDetails,
    loading: itemsLoading,
    error,
    isTransitioning,
    totalCountUnpurchased,
    totalCountPurchased,
    loadMoreUnpurchased,
    hasMoreUnpurchased,
    isLoadingMoreUnpurchased,
    loadMorePurchased,
    hasMorePurchased,
    isLoadingMorePurchased,
    searchQuery,
    setSearchQuery,
    addItem,
    updateItem,
    removeItem,
    toggleItem,
    refetch,
    getItemById,
    getCompletedItems,
    getPendingItems,
    getItemsByCategory,
  } = useShoppingListManagement(currentListId);

  // 4. Transform: Convert raw items to UI format (single consolidated call)
  // Transforms all arrays in one useMemo call for better performance
  const { sortableItems, unpurchasedItems: transformedUnpurchasedItems, purchasedItems: transformedPurchasedItems } =
    useShoppingListTransformMulti({
      items,
      rawUnpurchasedItems,
      rawPurchasedItems,
    });

  // 5. Ownership: Enrich lists with ownership info
  const listDataWithOwnership = lists.map(list => ({
    ...list,
    _isOwner: isShoppingListOwner(list, user?.id),
  }));

  // Derived: Initial loading state (loading with no data)
  const isLoadingInitial = (listsLoading || itemsLoading) && items.length === 0;
  const loading = listsLoading || itemsLoading;

  return {
    // Lists
    lists,
    listDataWithOwnership,
    currentList,
    currentListDetails,
    currentListId,
    defaultList,

    // Selection
    selectedShoppingListId,
    setSelectedShoppingListId,

    // Items (transformed for UI)
    items,
    sortableItems,
    unpurchasedItems: transformedUnpurchasedItems,
    purchasedItems: transformedPurchasedItems,
    rawUnpurchasedItems,

    // Loading states
    loading,
    isLoadingInitial,
    isTransitioning,
    error,

    // Total counts
    totalCountUnpurchased,
    totalCountPurchased,

    // Pagination
    loadMoreUnpurchased,
    hasMoreUnpurchased,
    isLoadingMoreUnpurchased,
    loadMorePurchased,
    hasMorePurchased,
    isLoadingMorePurchased,

    // Search
    searchQuery,
    setSearchQuery,

    // Actions
    addItem,
    updateItem,
    removeItem,
    toggleItem,
    refetch,

    // Helpers
    allItems,
    getItemById,
    getCompletedItems,
    getPendingItems,
    getItemsByCategory,
  };
}

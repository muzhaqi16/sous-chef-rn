
import { useEffect, useDeferredValue } from 'react';

import { useAuth } from '#/hooks/auth/useAuth';
import { preloadImages } from '#components/atoms/CachedImage';
import { isShoppingListOwner } from '#utils/ownershipHelpers';
import { resolveImageUrl } from '#utils/imageUtils';
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
    optimisticListId,
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  } = useShoppingListSelection(lists);

  // 3. Items: Fetch and manage items for current list (with pagination)
  // Returns paginated unpurchasedItems and purchasedItems
  // PERF: Use optimisticListId so queries fire immediately with the persisted
  // Zustand ID, breaking the waterfall that previously waited for lists to load.
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
  } = useShoppingListManagement(optimisticListId);

  // 4. Transform: Convert raw items to UI format (single consolidated call)
  const { unpurchasedItems: transformedUnpurchasedItems, purchasedItems: transformedPurchasedItems } =
    useShoppingListTransformMulti({
      rawUnpurchasedItems,
      rawPurchasedItems,
    });

  // Defer Apollo cache/subscription updates so scroll events aren't blocked.
  // Applied AFTER transform to avoid stale-data issues that caused FlashList blank cells.
  const deferredUnpurchased = useDeferredValue(transformedUnpurchasedItems);
  const deferredPurchased = useDeferredValue(transformedPurchasedItems);

  // Derive sortableItems from deferred values
  const sortableItems = [...deferredUnpurchased, ...deferredPurchased];

  // 5. Ownership: Enrich lists with ownership info
  const listDataWithOwnership = lists.map(list => ({
    ...list,
    _isOwner: isShoppingListOwner(list, user?.id),
  }));

  // Preload shopping list item images into disk cache for instant display
  // PERF: Defer to idle to avoid competing with in-flight queries during critical load
  useEffect(() => {
    if (items.length > 0) {
      const urls = items
        .map(item => resolveImageUrl(item))
        .filter((url): url is string => !!url);
      if (urls.length > 0) {
        const handle = requestIdleCallback(() => {
          preloadImages(urls);
        });
        return () => cancelIdleCallback(handle);
      }
    }
  }, [items]);

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
    unpurchasedItems: deferredUnpurchased,
    purchasedItems: deferredPurchased,
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

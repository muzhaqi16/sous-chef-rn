
import { useEffect, useDeferredValue } from 'react';

import { useAuthUser } from '#/hooks/auth/useAuthUser';
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
  const user = useAuthUser();

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
    unpurchasedItems: filteredUnpurchasedItems,
    purchasedItems: filteredPurchasedItems,
    rawUnpurchasedItems,
    rawPurchasedItems,
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
  } = useShoppingListManagement(optimisticListId);

  // 4. Transform: Convert raw items to UI format (single consolidated call)
  const { unpurchasedItems: transformedUnpurchasedItems, purchasedItems: transformedPurchasedItems } =
    useShoppingListTransformMulti({
      rawUnpurchasedItems: filteredUnpurchasedItems,
      rawPurchasedItems: filteredPurchasedItems,
    });

  // Defer Apollo cache/subscription updates so scroll events aren't blocked.
  // Applied AFTER transform to avoid stale-data issues that caused FlashList blank cells.
  const deferredUnpurchased = useDeferredValue(transformedUnpurchasedItems);
  const deferredPurchased = useDeferredValue(transformedPurchasedItems);

  // Bypass deferred rendering when not searching — matches PantryMain pattern.
  // Deferred rendering only benefits rapid search-typing updates.
  // Without search, data updates (subscriptions, pagination) render normally,
  // avoiding the delayed batch re-render that causes large frame gaps.
  const unpurchasedItems = searchQuery ? deferredUnpurchased : transformedUnpurchasedItems;
  const purchasedItems = searchQuery ? deferredPurchased : transformedPurchasedItems;

  // 5. Ownership: Enrich lists with ownership info
  const listDataWithOwnership = lists.map(list => ({
    ...list,
    _isOwner: isShoppingListOwner(list, user?.id),
  }));

  // Preload shopping list item images into disk cache for instant display
  // PERF: Defer to idle to avoid competing with in-flight queries during critical load
  useEffect(() => {
    if (rawUnpurchasedItems.length > 0 || rawPurchasedItems.length > 0) {
      const urls = [...rawUnpurchasedItems, ...rawPurchasedItems]
        .map(item => resolveImageUrl(item))
        .filter((url): url is string => !!url);
      if (urls.length > 0) {
        const handle = requestIdleCallback(() => {
          preloadImages(urls);
        });
        return () => cancelIdleCallback(handle);
      }
    }
  }, [rawUnpurchasedItems, rawPurchasedItems]);

  // Derived: Initial loading state (loading with no data)
  const isLoadingInitial = (listsLoading || itemsLoading) && rawUnpurchasedItems.length === 0 && rawPurchasedItems.length === 0;
  const loading = listsLoading || itemsLoading;

  return {
    state: {
      // Lists
      lists,
      listDataWithOwnership,
      currentList,
      currentListDetails,
      currentListId,
      defaultList,
      selectedShoppingListId,

      // Items (transformed for UI)
      unpurchasedItems,
      purchasedItems,
      rawUnpurchasedItems,
      rawPurchasedItems,

      // Loading states
      loading,
      isLoadingInitial,
      isTransitioning,
      error,

      // Total counts
      totalCountUnpurchased,
      totalCountPurchased,

      // Pagination state
      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      hasMorePurchased,
      isLoadingMorePurchased,

      // Search
      searchQuery,
    },
    actions: {
      setSelectedShoppingListId,
      setSearchQuery,
      addItem,
      updateItem,
      removeItem,
      toggleItem,
      refetch,
      loadMoreUnpurchased,
      loadMorePurchased,
    },
  };
}

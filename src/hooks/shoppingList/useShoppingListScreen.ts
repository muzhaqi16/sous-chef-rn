import { useEffect, useDeferredValue, useState } from 'react';

import { useAuthUser } from '#/hooks/auth/useAuthUser';
import { preloadImages } from '#components/atoms/CachedImage';
import { isShoppingListOwner } from '#utils/ownershipHelpers';
import { resolveImageUrl } from '#utils/imageUtils';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
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

  // 4a. Image preference: defer "disable" to pull-to-refresh, apply "enable" immediately
  const showImagesPreference = useShowShoppingListImages();
  const [displayedShowImages, setDisplayedShowImages] =
    useState(showImagesPreference);

  // Immediately propagate enable (false → true); disable (true → false) deferred to refetch
  if (showImagesPreference && !displayedShowImages) {
    setDisplayedShowImages(true);
  }

  // Wrap refetch to sync displayed preference on pull-to-refresh
  const refetchWithImageSync = () => {
    setDisplayedShowImages(showImagesPreference);
    return refetch();
  };

  // 4b. Transform: Convert raw items to UI format (single consolidated call)
  const {
    unpurchasedItems: transformedUnpurchasedItems,
    purchasedItems: transformedPurchasedItems,
  } = useShoppingListTransformMulti({
    rawUnpurchasedItems: filteredUnpurchasedItems,
    rawPurchasedItems: filteredPurchasedItems,
    showImages: displayedShowImages,
  });

  // Defer data updates so pagination and subscription renders don't block scroll.
  // Applied AFTER transform to avoid stale-data issues that caused FlashList blank cells.
  // Always-on deferral (not just during search) — matches PantryContent pattern where
  // useDeferredValue reduced pagination render times from 680ms to 220ms.
  const unpurchasedItems = useDeferredValue(transformedUnpurchasedItems);
  const purchasedItems = useDeferredValue(transformedPurchasedItems);

  // 5. Ownership: Enrich lists with ownership info
  const listDataWithOwnership = lists.map(list => ({
    ...list,
    _isOwner: isShoppingListOwner(list, user?.id),
  }));

  // Preload shopping list item images into disk cache for instant display
  // PERF: Defer to idle to avoid competing with in-flight queries during critical load
  // Skip preloading when images are disabled to save bandwidth and disk space
  useEffect(() => {
    if (!displayedShowImages) return;
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
  }, [rawUnpurchasedItems, rawPurchasedItems, displayedShowImages]);

  // Derived: Initial loading state (loading with no data)
  const isLoadingInitial =
    (listsLoading || itemsLoading) &&
    rawUnpurchasedItems.length === 0 &&
    rawPurchasedItems.length === 0;
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
      refetch: refetchWithImageSync,
      loadMoreUnpurchased,
      loadMorePurchased,
    },
  };
}

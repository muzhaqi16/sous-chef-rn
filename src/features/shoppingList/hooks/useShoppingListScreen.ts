import { useEffect, useDeferredValue, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';

import { useUser } from '#store/useAppStore';
import { preloadImages } from '#components/atoms/CachedImage';
import { isShoppingListOwner } from '#utils/ownershipHelpers';
import { resolveImageUrl } from '#utils/imageUtils';
import { isResourceAccessLostError } from '#/utils/errors/graphqlErrors';
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
  const user = useUser();
  const client = useApolloClient();

  // 1. Query: Fetch all user's shopping lists (independent of home)
  const { lists, loading: listsLoading } = useShoppingListsQuery();

  // Lists whose read came back AUTHZ_FORBIDDEN, or null (deleted/unshared), this
  // session. Excluded from selection so auto-select can't re-pick a list the user
  // lost access to while its (cache-only) entry lingers before the lite query drops it.
  const [deniedListIds, setDeniedListIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // 2. Selection: Determine current list with auto-select
  const {
    optimisticListId,
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  } = useShoppingListSelection(lists, deniedListIds);

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
    listNotFound,
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
    recordPurchase,
    refetch,
  } = useShoppingListManagement(optimisticListId);

  // 3b. Access-loss detection. When the selected list's read no longer reaches a
  // visible list, record its id. Two causes: (a) access revoked — a collaborator
  // on a list that became home-linked, surfaced as an AUTHZ_FORBIDDEN `error`; or
  // (b) deleted/unshared — the by-id read resolves to null data (`listNotFound`),
  // not an error. useShoppingListSelection then excludes the id and auto-selects
  // the next valid list, instead of the cache-and-network + previousData fallback
  // keeping the stale, now-inaccessible list on screen.
  // "Adjusting state during render" (not an effect) per project conventions.
  if (
    optimisticListId &&
    !deniedListIds.has(optimisticListId) &&
    (listNotFound || isResourceAccessLostError(error))
  ) {
    const deniedId = optimisticListId;
    setDeniedListIds(prev => new Set(prev).add(deniedId));
  }

  // Evict denied lists from the (persisted) cache so they don't resurface from a
  // cold-start hydrate. Pure cache side-effect — no React state set here.
  useEffect(() => {
    if (deniedListIds.size === 0) return;
    deniedListIds.forEach(id => {
      client.cache.evict({
        id: client.cache.identify({ __typename: 'ShoppingList', id }),
      });
    });
    client.cache.gc();
  }, [deniedListIds, client]);

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

  // 4b. Wrap nodes into FlashList row items. Display data is no longer
  // pre-computed — each row reads its fields via `useFragment` internally.
  const {
    unpurchasedItems: transformedUnpurchasedItems,
    purchasedItems: transformedPurchasedItems,
  } = useShoppingListTransformMulti({
    rawUnpurchasedItems: filteredUnpurchasedItems,
    rawPurchasedItems: filteredPurchasedItems,
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

  // Derived loading states — single source of truth for all downstream components
  const loading = listsLoading || itemsLoading;
  const hasUIItems = unpurchasedItems.length > 0 || purchasedItems.length > 0;
  const hasRawData =
    rawUnpurchasedItems.length > 0 || rawPurchasedItems.length > 0;

  // True until deferred UI items are ready for first display.
  // Covers: queries in flight AND useDeferredValue gap (raw data arrived but UI lags a frame).
  const isLoadingInitial = !hasUIItems && (loading || hasRawData);

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

      // Row display preference (gated on pull-to-refresh for "disable")
      showImages: displayedShowImages,
    },
    actions: {
      setSelectedShoppingListId,
      setSearchQuery,
      addItem,
      updateItem,
      removeItem,
      toggleItem,
      recordPurchase,
      refetch: refetchWithImageSync,
      loadMoreUnpurchased,
      loadMorePurchased,
    },
  };
}

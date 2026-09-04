import { useEffect, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';

import { useUser } from '#store/useAppStore';
import { preloadImages } from '#components/atoms/CachedImage';
import { isShoppingListOwner } from '#features/shoppingList/utils/ownershipHelpers';
import { resolveImageUrl } from '#utils/imageUtils';
import { isResourceAccessLostError } from '#/utils/errors/graphqlErrors';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import { useShoppingListsQuery } from './useShoppingListsQuery';
import { useShoppingListSelection } from './useShoppingListSelection';
import { useShoppingListTransformMulti } from './useShoppingListTransform';
import { useShoppingListManagement } from './useShoppingListManagement';

/** Facade for the shopping list screen: lists, selection, items, transform. */
export function useShoppingListScreen() {
  const user = useUser();
  const client = useApolloClient();

  const {
    lists,
    loading: listsLoading,
    error: listsError,
    hasResult: listsHasResult,
  } = useShoppingListsQuery();

  // Lists whose read came back FORBIDDEN, or null (deleted/unshared), this
  // session. Excluded from selection so auto-select can't re-pick a list the user
  // lost access to while its (cache-only) entry lingers before the lite query drops it.
  const [deniedListIds, setDeniedListIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const {
    optimisticListId,
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  } = useShoppingListSelection(lists, deniedListIds);

  // `optimisticListId` (the persisted Zustand id) rather than `currentListId`, so
  // the item queries fire without waiting on the lists query.
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
    removeItem,
    toggleItem,
    recordPurchase,
    refetch,
  } = useShoppingListManagement(optimisticListId);

  // Access loss arrives two ways: revoked access is a FORBIDDEN `error`, while a
  // deleted/unshared list resolves to null data (`listNotFound`). Recording the
  // id lets selection auto-pick the next valid list, instead of the
  // previousData fallback holding a stale, inaccessible one on screen.
  // Adjusting state during render, not an effect.
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

  // Turning images off waits for pull-to-refresh; turning them on is immediate.
  const showImagesPreference = useShowShoppingListImages();
  const [displayedShowImages, setDisplayedShowImages] =
    useState(showImagesPreference);

  if (showImagesPreference && !displayedShowImages) {
    setDisplayedShowImages(true);
  }

  const refetchWithImageSync = () => {
    setDisplayedShowImages(showImagesPreference);
    return refetch();
  };

  // These reach FlashList as-is — NEVER through `useDeferredValue` or a
  // transition. FlashList truncates its layout table during render and re-indexes
  // at commit; only an interruptible render leaves a gap where a native
  // `onLayout` throws "index out of bounds, not enough layouts", fatal in
  // release. See docs/flashlist-layout-index-race.md.
  const { unpurchasedItems, purchasedItems } = useShoppingListTransformMulti({
    rawUnpurchasedItems: filteredUnpurchasedItems,
    rawPurchasedItems: filteredPurchasedItems,
  });

  const listDataWithOwnership = lists.map(list => ({
    ...list,
    _isOwner: isShoppingListOwner(list, user?.id),
  }));

  // Warm the disk cache, deferred to idle so it does not compete with in-flight
  // queries during the critical load.
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

  const loading = listsLoading || itemsLoading;
  const hasUIItems = unpurchasedItems.length > 0 || purchasedItems.length > 0;

  // Measured on the rows the list would actually RENDER: adding a term for the
  // unfiltered rows makes a search that matches none of them read as "still
  // loading" and show skeletons over an answer that has already arrived.
  const isLoadingInitial = !hasUIItems && loading;

  return {
    state: {
      lists,
      listDataWithOwnership,
      currentList,
      currentListDetails,
      currentListId,
      defaultList,
      selectedShoppingListId,

      unpurchasedItems,
      purchasedItems,
      rawUnpurchasedItems,
      rawPurchasedItems,

      loading,
      isLoadingInitial,
      isTransitioning,
      error,
      listsLoading,
      listsError,
      listsHasResult,

      totalCountUnpurchased,
      totalCountPurchased,

      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      hasMorePurchased,
      isLoadingMorePurchased,

      searchQuery,

      /** Lags the stored preference when turning images OFF; see above. */
      showImages: displayedShowImages,
    },
    actions: {
      setSelectedShoppingListId,
      setSearchQuery,
      addItem,
      removeItem,
      toggleItem,
      recordPurchase,
      refetch: refetchWithImageSync,
      loadMoreUnpurchased,
      loadMorePurchased,
    },
  };
}

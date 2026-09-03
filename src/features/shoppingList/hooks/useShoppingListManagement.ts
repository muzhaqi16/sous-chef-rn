import { useState } from 'react';
import { shoppingListItemSearch } from '#/utils/searchUtils';
import { useShoppingListItemsQuery } from './useShoppingListItemsQuery';
import { usePaginatedShoppingItems } from './usePaginatedShoppingItems';
import { useShoppingListItemMutations } from './mutations/useShoppingListItemMutations';

/**
 * Data-layer composition for the shopping list screen. `currentListId` must come
 * from `useShoppingListSelection`, which guarantees it exists in the available
 * lists so no query fires for a deleted one.
 */
export function useShoppingListManagement(currentListId: string | undefined) {
  const {
    shoppingList,
    notFound: listNotFound,
    error: listError,
  } = useShoppingListItemsQuery(currentListId);

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

  const unpurchasedItems = unpurchased.items;
  const purchasedItems = purchased.items;
  // The entity-level counts are server-authoritative; the connection's
  // `totalCount` reflects only the pages the client has fetched.
  const totalCountPurchased =
    purchased.totalCount ?? shoppingList?.completedItems ?? 0;
  const totalItemsEntity = shoppingList?.totalItems;
  const totalCountUnpurchased =
    unpurchased.totalCount ??
    (totalItemsEntity != null
      ? Math.max(0, totalItemsEntity - (shoppingList?.completedItems ?? 0))
      : 0);

  const loading = itemsLoading;
  const error = listError || itemsError;

  const { addItem, removeItem, toggleItem, recordPurchase } =
    useShoppingListItemMutations(currentListId, refetch);

  // Plain state: the filtering below is PER TAB, so a list-filtering hook was
  // being handed an empty array purely to borrow its query state — and its
  // debounce never reached the caller, which read the raw query.
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUnpurchasedItems = !searchQuery.trim()
    ? unpurchasedItems
    : unpurchasedItems.filter(item =>
        shoppingListItemSearch(item, searchQuery),
      );

  const filteredPurchasedItems = !searchQuery.trim()
    ? purchasedItems
    : purchasedItems.filter(item => shoppingListItemSearch(item, searchQuery));

  return {
    unpurchasedItems: filteredUnpurchasedItems,
    purchasedItems: filteredPurchasedItems,
    // Unfiltered, for preloading and loading checks.
    rawUnpurchasedItems: unpurchasedItems,
    rawPurchasedItems: purchasedItems,
    shoppingList,
    listNotFound, // Server returned null for the list (deleted/unshared)
    loading,
    error,
    isTransitioning,

    totalCountUnpurchased,
    totalCountPurchased,

    loadMoreUnpurchased: unpurchased.loadMore,
    hasMoreUnpurchased: unpurchased.hasMore,
    isLoadingMoreUnpurchased: unpurchased.isLoadingMore,

    loadMorePurchased: purchased.loadMore,
    hasMorePurchased: purchased.hasMore,
    isLoadingMorePurchased: purchased.isLoadingMore,

    searchQuery,
    setSearchQuery,

    addItem,
    removeItem,
    toggleItem,
    recordPurchase,
    refetch,
  };
}

import { useState, useEffect } from 'react';
import {
  useGetShoppingListItemsFilteredQuery,
  ShoppingListItemDisplayFragment,
  GetShoppingListItemsFilteredQuery,
} from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { PAGINATION } from '#/constants/shoppingList';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { usePagination } from '#hooks/utils/usePagination';
import { executeRefetch } from '#/utils/compilerSafeWrappers';

interface UsePaginatedShoppingItemsOptions {
  listId: string | null | undefined;
  skip?: boolean;
}

interface ConnectionData {
  items: ShoppingListItemDisplayFragment[];
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  loadMoreError: boolean;
}

interface UsePaginatedShoppingItemsResult {
  unpurchased: ConnectionData;
  purchased: ConnectionData;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
  isTransitioning: boolean;
}

// --- Helpers (module-level for stability) ---

type ItemEdge = NonNullable<
  GetShoppingListItemsFilteredQuery['shoppingList']
>['itemsConnection']['edges'][number];

/**
 * Extract items from connection edges in cache insertion order.
 * Filters out incomplete nodes (missing id/itemName) to guard against
 * stale cache entries from subscription syncs between devices.
 *
 * No client-side sort: the server returns items in sortOrder ASC,
 * the cache merge appends pages in order, and drag-reorder re-sorts
 * edges directly in the cache via useItemReordering's cache.modify.
 */
function extractItems(edges: readonly ItemEdge[] | null | undefined): ShoppingListItemDisplayFragment[] {
  if (!edges) return [];
  return edges
    .filter(edge => {
      const node = edge?.node;
      return node && node.id && node.itemName;
    })
    .map(edge => edge.node);
}

/** Resolve edges: prefer current data, fall back to previous data (same list only) */
function resolveEdges(
  data: GetShoppingListItemsFilteredQuery | undefined,
  previousData: GetShoppingListItemsFilteredQuery | undefined,
  listIdChanged: boolean,
): readonly ItemEdge[] {
  if (listIdChanged) {
    return data?.shoppingList?.itemsConnection?.edges ?? [];
  }
  return (
    data?.shoppingList?.itemsConnection?.edges ??
    previousData?.shoppingList?.itemsConnection?.edges ??
    []
  );
}

/**
 * usePaginatedShoppingItems — Two independent queries for shopping list tabs
 *
 * Uses two calls to GetShoppingListItemsFiltered (one per tab) so each tab
 * has its own cursor, cache entry, and fetchMore — eliminating the alias-based
 * cross-contamination and ordering bugs from the previous single-query approach.
 *
 * Apollo's `keyArgs: ['filters']` on `itemsConnection` ensures separate cache
 * entries per `isPurchased` filter value.
 */
export function usePaginatedShoppingItems({
  listId,
  skip = false,
}: UsePaginatedShoppingItemsOptions): UsePaginatedShoppingItemsResult {
  const { isLoggedOut } = useAuth();

  const hasValidListId = !!listId && !isLoggedOut;
  const shouldSkip = skip || !hasValidListId;

  // Track previous listId to detect list switches (compiler-safe pattern)
  const [previousListId, setPreviousListId] = useState<string | null | undefined>(listId);
  const listIdChanged = previousListId !== listId;
  if (listIdChanged) { setPreviousListId(listId); }

  // Defer purchased query until JS thread is idle — it's for the non-default tab
  const [purchasedReady, setPurchasedReady] = useState(false);
  if (listIdChanged) { setPurchasedReady(false); }

  useEffect(() => {
    if (shouldSkip) return;
    const id = requestIdleCallback(() => setPurchasedReady(true));
    return () => cancelIdleCallback(id);
  }, [shouldSkip, listId]);

  // --- Two independent queries ---
  const {
    data: unpurchasedData,
    previousData: unpurchasedPrevData,
    loading: uLoading,
    error: uError,
    fetchMore: uFetchMore,
    refetch: uRefetch,
  } = useGetShoppingListItemsFilteredQuery({
    variables: { id: listId!, first: PAGINATION.ITEMS_PAGE_SIZE, isPurchased: false },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  const {
    data: purchasedData,
    previousData: purchasedPrevData,
    loading: pLoading,
    error: pError,
    fetchMore: pFetchMore,
    refetch: pRefetch,
  } = useGetShoppingListItemsFilteredQuery({
    variables: { id: listId!, first: PAGINATION.ITEMS_PAGE_SIZE, isPurchased: true },
    skip: shouldSkip || !purchasedReady,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  useApolloErrorLogger('GetShoppingListItemsFiltered[unpurchased]', uError);
  useApolloErrorLogger('GetShoppingListItemsFiltered[purchased]', pError);

  // --- Extract items ---
  const unpurchasedEdges = resolveEdges(unpurchasedData, unpurchasedPrevData, listIdChanged);
  const unpurchasedItems = extractItems(unpurchasedEdges);

  const purchasedEdges = resolveEdges(purchasedData, purchasedPrevData, listIdChanged);
  const purchasedItems = extractItems(purchasedEdges);

  // --- Pagination via reusable usePagination hook ---
  const unpurchasedPagination = usePagination({
    pageInfo: unpurchasedData?.shoppingList?.itemsConnection?.pageInfo,
    loading: uLoading,
    itemCount: unpurchasedItems.length,
    fetchMore: uFetchMore,
    cursorVariableName: 'after',
  });

  const purchasedPagination = usePagination({
    pageInfo: purchasedData?.shoppingList?.itemsConnection?.pageInfo,
    loading: pLoading,
    itemCount: purchasedItems.length,
    fetchMore: pFetchMore,
    cursorVariableName: 'after',
  });

  // --- Counts ---
  const unpurchasedTotalCount =
    unpurchasedData?.shoppingList?.itemsConnection?.totalCount ?? 0;
  const purchasedTotalCount =
    purchasedData?.shoppingList?.itemsConnection?.totalCount ?? 0;

  // --- Refetch both queries ---
  const handleRefetch = async () => {
    await Promise.all([
      executeRefetch(uRefetch, '[usePaginatedShoppingItems] Unpurchased refetch failed:'),
      executeRefetch(pRefetch, '[usePaginatedShoppingItems] Purchased refetch failed:'),
    ]);
  };

  // Auto-refetch when edges are depleted but totalCount indicates items remain
  // (e.g., all visible items toggled but server has more pages)
  useEffect(() => {
    const purchasedNeedsRefetch =
      purchasedTotalCount > 0 && purchasedItems.length === 0 && !pLoading;
    const unpurchasedNeedsRefetch =
      unpurchasedTotalCount > 0 && unpurchasedItems.length === 0 && !uLoading;

    if (!hasValidListId || (!purchasedNeedsRefetch && !unpurchasedNeedsRefetch)) {
      return;
    }

    const idleId = requestIdleCallback(() => {
      if (unpurchasedNeedsRefetch) {
        executeRefetch(uRefetch, '[usePaginatedShoppingItems] Auto-refetch unpurchased failed:');
      }
      if (purchasedNeedsRefetch) {
        executeRefetch(pRefetch, '[usePaginatedShoppingItems] Auto-refetch purchased failed:');
      }
    });

    return () => { cancelIdleCallback(idleId); };
  }, [
    purchasedTotalCount,
    purchasedItems.length,
    unpurchasedTotalCount,
    unpurchasedItems.length,
    pLoading,
    uLoading,
    hasValidListId,
    uRefetch,
    pRefetch,
  ]);

  // --- Combined loading state ---
  // Only block on unpurchased (the default tab); purchased is deferred
  const loading = uLoading && unpurchasedItems.length === 0;

  return {
    unpurchased: {
      items: unpurchasedItems,
      totalCount: unpurchasedTotalCount,
      hasMore: unpurchasedPagination.hasMore,
      isLoadingMore: unpurchasedPagination.isLoadingMore,
      loadMore: unpurchasedPagination.loadMore,
      loadMoreError: unpurchasedPagination.loadMoreError,
    },
    purchased: {
      items: purchasedItems,
      totalCount: purchasedTotalCount,
      hasMore: purchasedPagination.hasMore,
      isLoadingMore: purchasedPagination.isLoadingMore,
      loadMore: purchasedPagination.loadMore,
      loadMoreError: purchasedPagination.loadMoreError,
    },
    loading,
    error: (uError ?? pError) as Error | undefined,
    refetch: handleRefetch,
    isTransitioning: listIdChanged && (uLoading || pLoading),
  };
}

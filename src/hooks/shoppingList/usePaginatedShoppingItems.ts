import { useRef, useState, useEffect } from 'react';
import {
  useGetShoppingListItemsPaginatedQuery,
  ShoppingListItemDisplayFragment } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { PAGINATION } from '#/constants/shoppingList';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { executeRefetch, executeMutationWithErrorHandler } from '#/utils/compilerSafeWrappers';

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
}

interface UsePaginatedShoppingItemsResult {
  unpurchased: ConnectionData;
  purchased: ConnectionData;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
  isTransitioning: boolean;
}

/**
 * usePaginatedShoppingItems - Combined query for shopping list items
 *
 * Uses a single GraphQL query with aliases to fetch BOTH unpurchased and purchased
 * items in ONE request. Each tab has independent pagination cursors.
 *
 * This avoids Apollo cache key collisions that occur when making two separate
 * queries to the same itemsConnection field with different filters.
 *
 * @param options.listId - The shopping list ID to fetch items for
 * @param options.skip - Skip the query (useful when listId is not yet available)
 */
export function usePaginatedShoppingItems({
  listId,
  skip = false }: UsePaginatedShoppingItemsOptions): UsePaginatedShoppingItemsResult {
  const { isLoggedOut } = useAuth();

  // Track if we're currently loading more for each tab
  const isLoadingMoreUnpurchasedRef = useRef(false);
  const isLoadingMorePurchasedRef = useRef(false);

  // Guard to prevent multiple auto-refetches when edges are depleted
  const isAutoRefetchingRef = useRef(false);

  // Validate list ID
  const hasValidListId = !!listId && !isLoggedOut;
  const shouldSkip = skip || !hasValidListId;

  // Track previous listId to detect list switches (compiler-safe pattern)
  const [previousListId, setPreviousListId] = useState<string | null | undefined>(listId);
  const listIdChanged = previousListId !== listId;
  if (listIdChanged) { setPreviousListId(listId); }

  // Single query fetches BOTH unpurchased and purchased items
  const { data, previousData, loading, error, fetchMore, refetch } =
    useGetShoppingListItemsPaginatedQuery({
      variables: {
        id: listId!,
        first: PAGINATION.ITEMS_PAGE_SIZE },
      skip: shouldSkip,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      errorPolicy: 'all',
      // NOTE: notifyOnNetworkStatusChange removed to prevent unnecessary re-renders during fetchMore
      // With this option enabled, Apollo would trigger component re-renders when network status changes
      // (e.g., loading -> ready) during pagination, causing FlashList flickering/gaps during fast scroll
    });

  useApolloErrorLogger('GetShoppingListItemsPaginated', error);

  // Helper to extract and sort items from edges
  // Includes defensive filtering to prevent blank items from appearing when
  // cache has incomplete data (e.g., after subscription sync between devices)
  const extractItems = (
      edges:
        | Array<{ node: ShoppingListItemDisplayFragment }>
        | null
        | undefined,
    ): ShoppingListItemDisplayFragment[] => {
      if (!edges) return [];
      return edges
        .filter(edge => {
          // Filter out edges with missing/incomplete nodes
          // This prevents blank items from appearing when cache has stale data
          const node = edge?.node;
          return node && node.id && node.itemName;
        })
        .map(edge => edge.node)
        .sort((a, b) => {
          // Use lexicographic comparison for fractional-indexing keys
          // The fractional-indexing library uses alphabet '0-9A-Za-z' which is designed
          // for standard string comparison (<, >), NOT localeCompare() which is locale-sensitive
          const sortA = a.sortOrder ?? 'zzz';
          const sortB = b.sortOrder ?? 'zzz';
          if (sortA < sortB) return -1;
          if (sortA > sortB) return 1;
          return 0;
        });
    };

  // Extract unpurchased items
  const unpurchasedEdges = listIdChanged
    ? data?.shoppingList?.unpurchasedItems?.edges ?? []
    : data?.shoppingList?.unpurchasedItems?.edges ??
      previousData?.shoppingList?.unpurchasedItems?.edges ??
      [];
  const unpurchasedItems = extractItems(unpurchasedEdges);

  // Extract purchased items
  const purchasedEdges = listIdChanged
    ? data?.shoppingList?.purchasedItems?.edges ?? []
    : data?.shoppingList?.purchasedItems?.edges ??
      previousData?.shoppingList?.purchasedItems?.edges ??
      [];
  const purchasedItems = extractItems(purchasedEdges);

  // Extract pagination info for unpurchased
  const unpurchasedPageInfo = data?.shoppingList?.unpurchasedItems?.pageInfo;
  const unpurchasedHasMore = unpurchasedPageInfo?.hasNextPage ?? false;
  const unpurchasedEndCursor = unpurchasedPageInfo?.endCursor;
  const unpurchasedTotalCount =
    data?.shoppingList?.unpurchasedItems?.totalCount ?? 0;

  // Extract pagination info for purchased
  const purchasedPageInfo = data?.shoppingList?.purchasedItems?.pageInfo;
  const purchasedHasMore = purchasedPageInfo?.hasNextPage ?? false;
  const purchasedEndCursor = purchasedPageInfo?.endCursor;
  const purchasedTotalCount =
    data?.shoppingList?.purchasedItems?.totalCount ?? 0;

  // Determine loading more states
  const isLoadingMoreUnpurchased = loading && unpurchasedItems.length > 0;
  const isLoadingMorePurchased = loading && purchasedItems.length > 0;

  // Load more unpurchased items
  const loadMoreUnpurchased = async () => {
    if (
      !unpurchasedHasMore ||
      isLoadingMoreUnpurchasedRef.current ||
      !unpurchasedEndCursor
    ) {
      return;
    }

    isLoadingMoreUnpurchasedRef.current = true;
    const result = await executeMutationWithErrorHandler(
      () => fetchMore({ variables: { unpurchasedAfter: unpurchasedEndCursor } }),
      (error) => {
        isLoadingMoreUnpurchasedRef.current = false;
        throw error;
      },
    );
    if (result !== false) {
      isLoadingMoreUnpurchasedRef.current = false;
    }
  };

  // Load more purchased items
  const loadMorePurchased = async () => {
    if (
      !purchasedHasMore ||
      isLoadingMorePurchasedRef.current ||
      !purchasedEndCursor
    ) {
      return;
    }

    isLoadingMorePurchasedRef.current = true;
    const result = await executeMutationWithErrorHandler(
      () => fetchMore({ variables: { purchasedAfter: purchasedEndCursor } }),
      (error) => {
        isLoadingMorePurchasedRef.current = false;
        throw error;
      },
    );
    if (result !== false) {
      isLoadingMorePurchasedRef.current = false;
    }
  };

  // Wrap refetch with error handling to ensure promise always resolves
  // This prevents the refresh spinner from getting stuck if refetch fails
  const handleRefetch = () => executeRefetch(refetch, '[usePaginatedShoppingItems] Refetch failed:');

  // Auto-refetch when edges are depleted but totalCount indicates items remain
  // This handles the case where all visible items are toggled but server has more
  // (pagination edge depletion scenario)
  useEffect(() => {
    // Skip if already refetching, loading, or no valid list
    if (isAutoRefetchingRef.current || loading || !hasValidListId) {
      return;
    }

    // Check for edge depletion: totalCount > 0 but no items in array
    const purchasedNeedsRefetch =
      purchasedTotalCount > 0 && purchasedItems.length === 0;
    const unpurchasedNeedsRefetch =
      unpurchasedTotalCount > 0 && unpurchasedItems.length === 0;

    if (purchasedNeedsRefetch || unpurchasedNeedsRefetch) {
      isAutoRefetchingRef.current = true;

      // Use setTimeout to avoid state update during render
      const timeoutId = setTimeout(() => {
        executeRefetch(refetch, '[usePaginatedShoppingItems] Auto-refetch failed:')
          .finally(() => { isAutoRefetchingRef.current = false; });
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        isAutoRefetchingRef.current = false;
      };
    }
  }, [
    purchasedTotalCount,
    purchasedItems.length,
    unpurchasedTotalCount,
    unpurchasedItems.length,
    loading,
    hasValidListId,
    refetch,
  ]);

  const unpurchased: ConnectionData = {
    items: unpurchasedItems,
    totalCount: unpurchasedTotalCount,
    hasMore: unpurchasedHasMore,
    isLoadingMore: isLoadingMoreUnpurchased,
    loadMore: loadMoreUnpurchased };

  const purchased: ConnectionData = {
    items: purchasedItems,
    totalCount: purchasedTotalCount,
    hasMore: purchasedHasMore,
    isLoadingMore: isLoadingMorePurchased,
    loadMore: loadMorePurchased };

  return {
    unpurchased,
    purchased,
    loading: loading && unpurchasedItems.length === 0 && purchasedItems.length === 0,
    error: error as Error | undefined,
    refetch: handleRefetch,
    isTransitioning: listIdChanged && loading };
}

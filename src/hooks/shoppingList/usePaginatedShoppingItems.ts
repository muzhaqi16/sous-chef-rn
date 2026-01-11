import { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  useGetShoppingListItemsPaginatedQuery,
  ShoppingListItemDisplayFragment,
} from '#generated';
import { useAuth } from '#hooks/auth/useAuth';

// Page size for pagination
const PAGE_SIZE = 25;

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
  skip = false,
}: UsePaginatedShoppingItemsOptions): UsePaginatedShoppingItemsResult {
  const { isLoggedOut } = useAuth();

  // Track if we're currently loading more for each tab
  const isLoadingMoreUnpurchasedRef = useRef(false);
  const isLoadingMorePurchasedRef = useRef(false);

  // Guard to prevent multiple auto-refetches when edges are depleted
  const isAutoRefetchingRef = useRef(false);

  // Validate list ID
  const hasValidListId = !!listId && !isLoggedOut;
  const shouldSkip = skip || !hasValidListId;

  // Track previous listId to detect list switches
  const previousListIdRef = useRef<string | null | undefined>(listId);
  const listIdChanged = previousListIdRef.current !== listId;

  useEffect(() => {
    previousListIdRef.current = listId;
  }, [listId]);

  // Single query fetches BOTH unpurchased and purchased items
  const { data, previousData, loading, error, fetchMore, refetch } =
    useGetShoppingListItemsPaginatedQuery({
      variables: {
        id: listId!,
        first: PAGE_SIZE,
      },
      skip: shouldSkip,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    });

  // Helper to extract and sort items from edges
  const extractItems = useCallback(
    (
      edges:
        | Array<{ node: ShoppingListItemDisplayFragment }>
        | null
        | undefined,
    ): ShoppingListItemDisplayFragment[] => {
      if (!edges) return [];
      return edges
        .map(edge => edge.node)
        .sort((a, b) => {
          const sortA = a.sortOrder ?? 'zzz';
          const sortB = b.sortOrder ?? 'zzz';
          return sortA.localeCompare(sortB);
        });
    },
    [],
  );

  // Extract unpurchased items
  const unpurchasedItems = useMemo((): ShoppingListItemDisplayFragment[] => {
    const edges = listIdChanged
      ? data?.shoppingList?.unpurchasedItems?.edges ?? []
      : data?.shoppingList?.unpurchasedItems?.edges ??
        previousData?.shoppingList?.unpurchasedItems?.edges ??
        [];
    return extractItems(edges);
  }, [
    listIdChanged,
    data?.shoppingList?.unpurchasedItems?.edges,
    previousData?.shoppingList?.unpurchasedItems?.edges,
    extractItems,
  ]);

  // Extract purchased items
  const purchasedItems = useMemo((): ShoppingListItemDisplayFragment[] => {
    const edges = listIdChanged
      ? data?.shoppingList?.purchasedItems?.edges ?? []
      : data?.shoppingList?.purchasedItems?.edges ??
        previousData?.shoppingList?.purchasedItems?.edges ??
        [];
    return extractItems(edges);
  }, [
    listIdChanged,
    data?.shoppingList?.purchasedItems?.edges,
    previousData?.shoppingList?.purchasedItems?.edges,
    extractItems,
  ]);

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
  const loadMoreUnpurchased = useCallback(async () => {
    if (
      !unpurchasedHasMore ||
      isLoadingMoreUnpurchasedRef.current ||
      !unpurchasedEndCursor
    ) {
      return;
    }

    isLoadingMoreUnpurchasedRef.current = true;

    try {
      await fetchMore({
        variables: {
          unpurchasedAfter: unpurchasedEndCursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.shoppingList?.unpurchasedItems) {
            return prev;
          }

          const prevEdges =
            prev.shoppingList?.unpurchasedItems?.edges ?? [];
          const newEdges =
            fetchMoreResult.shoppingList.unpurchasedItems.edges ?? [];

          return {
            ...prev,
            shoppingList: {
              ...prev.shoppingList!,
              unpurchasedItems: {
                ...fetchMoreResult.shoppingList.unpurchasedItems,
                edges: [...prevEdges, ...newEdges],
              },
            },
          };
        },
      });
    } finally {
      isLoadingMoreUnpurchasedRef.current = false;
    }
  }, [unpurchasedHasMore, unpurchasedEndCursor, fetchMore]);

  // Load more purchased items
  const loadMorePurchased = useCallback(async () => {
    if (
      !purchasedHasMore ||
      isLoadingMorePurchasedRef.current ||
      !purchasedEndCursor
    ) {
      return;
    }

    isLoadingMorePurchasedRef.current = true;

    try {
      await fetchMore({
        variables: {
          purchasedAfter: purchasedEndCursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.shoppingList?.purchasedItems) {
            return prev;
          }

          const prevEdges = prev.shoppingList?.purchasedItems?.edges ?? [];
          const newEdges =
            fetchMoreResult.shoppingList.purchasedItems.edges ?? [];

          return {
            ...prev,
            shoppingList: {
              ...prev.shoppingList!,
              purchasedItems: {
                ...fetchMoreResult.shoppingList.purchasedItems,
                edges: [...prevEdges, ...newEdges],
              },
            },
          };
        },
      });
    } finally {
      isLoadingMorePurchasedRef.current = false;
    }
  }, [purchasedHasMore, purchasedEndCursor, fetchMore]);

  // Wrap refetch with error handling to ensure promise always resolves
  // This prevents the refresh spinner from getting stuck if refetch fails
  const handleRefetch = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      // Log error but don't rethrow - let finally block run in caller
      console.warn('[usePaginatedShoppingItems] Refetch failed:', error);
    }
  }, [refetch]);

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
      const timeoutId = setTimeout(async () => {
        try {
          await refetch();
        } catch (error) {
          console.warn('[usePaginatedShoppingItems] Auto-refetch failed:', error);
        } finally {
          isAutoRefetchingRef.current = false;
        }
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

  return {
    unpurchased: {
      items: unpurchasedItems,
      totalCount: unpurchasedTotalCount,
      hasMore: unpurchasedHasMore,
      isLoadingMore: isLoadingMoreUnpurchased,
      loadMore: loadMoreUnpurchased,
    },
    purchased: {
      items: purchasedItems,
      totalCount: purchasedTotalCount,
      hasMore: purchasedHasMore,
      isLoadingMore: isLoadingMorePurchased,
      loadMore: loadMorePurchased,
    },
    loading: loading && unpurchasedItems.length === 0 && purchasedItems.length === 0,
    error: error as Error | undefined,
    refetch: handleRefetch,
  };
}

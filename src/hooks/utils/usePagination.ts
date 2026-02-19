import { useCallback, useRef } from 'react';

/**
 * Configuration for pagination from normalized data
 */
export interface PaginationConfig {
  /** Page info with hasNextPage and endCursor */
  pageInfo?: {
    hasNextPage?: boolean;
    endCursor?: string | null | undefined;
  };
  /** Whether the query is currently loading */
  loading: boolean;
  /** Current number of items (to determine if loading more) */
  itemCount: number;
  /** Apollo fetchMore function from query */
  fetchMore: (options: any) => Promise<any>;
  /** Additional variables to pass to fetchMore (e.g., id, filters) */
  fetchMoreVariables?: Record<string, any>;
  /** Name of the cursor variable (default: 'cursor') */
  cursorVariableName?: string;
}

/**
 * Return type for pagination hook
 */
export interface UsePaginationReturn {
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Cursor for the next page */
  endCursor: string | null | undefined;
  /** Function to load more items */
  loadMore: () => Promise<void>;
  /** Whether currently loading more items (not initial load) */
  isLoadingMore: boolean;
}

/**
 * Generic pagination hook for cursor-based pagination
 *
 * Extracts common pagination logic from management hooks to eliminate duplication.
 * Works with any Apollo query that uses Connection pattern with pageInfo.
 *
 * @example
 * // In a management hook
 * const { hasMore, loadMore, isLoadingMore } = usePagination({
 *   pageInfo: normalizedData?.itemsPageInfo,
 *   loading,
 *   itemCount: items.length,
 *   fetchMore,
 *   fetchMoreVariables: { id: listId },
 *   cursorVariableName: 'itemsCursor',
 * });
 *
 * @example
 * // For Query.recipes (no parent ID)
 * const { hasMore, loadMore, isLoadingMore } = usePagination({
 *   pageInfo: normalizedRecipes?.pageInfo,
 *   loading,
 *   itemCount: recipes.length,
 *   fetchMore,
 *   cursorVariableName: 'cursor',
 * });
 */
export function usePagination(config: PaginationConfig): UsePaginationReturn {
  const {
    pageInfo,
    loading,
    itemCount,
    fetchMore,
    fetchMoreVariables = {},
    cursorVariableName = 'cursor',
  } = config;

  const hasMore = pageInfo?.hasNextPage || false;
  const endCursor = pageInfo?.endCursor;

  // Stabilize fetchMoreVariables using a ref with serialization-based comparison
  // This prevents loadMore from being recreated on every render when callers
  // pass inline objects as fetchMoreVariables
  const fetchMoreVariablesRef = useRef(fetchMoreVariables);
  const serialized = JSON.stringify(fetchMoreVariables);
  const prevSerializedRef = useRef(serialized);
  if (prevSerializedRef.current !== serialized) {
    prevSerializedRef.current = serialized;
    fetchMoreVariablesRef.current = fetchMoreVariables;
  }

  const loadMore = useCallback(async () => {
    // Don't load if:
    // - No more items to load
    // - Already loading
    // - No cursor available
    if (!hasMore || loading || !endCursor) {
      return;
    }

    try {
      await fetchMore({
        variables: {
          ...fetchMoreVariablesRef.current,
          [cursorVariableName]: endCursor,
        },
      });
    } catch (error) {
      console.error('Failed to load more items:', error);
      // Fail silently - user can try scrolling again
    }
  }, [hasMore, loading, endCursor, fetchMore, cursorVariableName]);

  // Loading more = loading but already have items (not initial load)
  const isLoadingMore = loading && itemCount > 0;

  return {
    hasMore,
    endCursor,
    loadMore,
    isLoadingMore,
  };
}

import { useRef, useEffect, useState } from 'react';
import { errorService } from '#/services/errorService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import type { PaginationState } from '#hooks/types';

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
 * Return type for pagination hook.
 * Extends PaginationState with cursor and error tracking.
 */
export interface UsePaginationReturn extends PaginationState {
  /** Function to load more items */
  loadMore: () => Promise<void>;
  /** Cursor for the next page */
  endCursor: string | null | undefined;
  /** Whether the last loadMore call failed */
  loadMoreError: boolean;
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
  useEffect(() => {
    if (prevSerializedRef.current !== serialized) {
      prevSerializedRef.current = serialized;
      fetchMoreVariablesRef.current = fetchMoreVariables;
    }
  });

  // Ref guard prevents duplicate fetches when two rapid onEndReached calls
  // both read isFetchingMore as false before React batches the state update
  const isFetchingMoreRef = useRef(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  // Clear the ref guard only after React re-renders with updated hasMore/endCursor.
  // This prevents stale closures in onEndReached from firing loadMore with old values
  // during the window between fetchMore completion and re-render.
  useEffect(() => {
    if (!isFetchingMore) {
      isFetchingMoreRef.current = false;
    }
  });

  const loadMore = async () => {
    // Don't load if:
    // - No more items to load
    // - Already loading
    // - No cursor available
    // - Already fetching more (ref checked synchronously)
    if (!hasMore || loading || !endCursor || isFetchingMoreRef.current) {
      if (__DEV__) {
        console.log(`📊 [Pagination] loadMore guarded: hasMore=${hasMore} loading=${loading} cursor=${!!endCursor} fetching=${isFetchingMoreRef.current}`);
      }
      return;
    }

    isFetchingMoreRef.current = true;
    setIsFetchingMore(true);
    setLoadMoreError(false);

    const result = await executeMutation(
      () =>
        fetchMore({
          variables: {
            ...fetchMoreVariablesRef.current,
            [cursorVariableName]: endCursor,
          },
        }),
      error =>
        errorService.reportError(error, { operation: 'Pagination.loadMore' }),
    );

    setIsFetchingMore(false);
    if (result === false) {
      setLoadMoreError(true);
    }
  };

  const isLoadingMore = isFetchingMore;

  return {
    hasMore,
    endCursor,
    loadMore,
    isLoadingMore,
    loadMoreError,
  };
}

import { useRef, useEffect, useState } from 'react';
import { errorService } from '#/services/errorService';
import { executeMutationWithErrorHandler } from '#/utils/compilerSafeWrappers';

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
    fetchMore,
    fetchMoreVariables = {},
    cursorVariableName = 'cursor' } = config;

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

  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const loadMore = async () => {
    // Don't load if:
    // - No more items to load
    // - Already loading
    // - No cursor available
    // - Already fetching more
    if (!hasMore || loading || !endCursor || isFetchingMore) {
      return;
    }

    setIsFetchingMore(true);
    await executeMutationWithErrorHandler(
      () => fetchMore({
        variables: {
          ...fetchMoreVariablesRef.current,
          [cursorVariableName]: endCursor } }),
      (error) => errorService.reportError(error, { operation: 'Pagination.loadMore' }),
    );
    setIsFetchingMore(false);
  };

  const isLoadingMore = isFetchingMore;

  return {
    hasMore,
    endCursor,
    loadMore,
    isLoadingMore };
}

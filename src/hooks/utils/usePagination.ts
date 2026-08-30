import { useRef, useEffect, useState } from 'react';
import type { OperationVariables } from '@apollo/client';
import { errorService } from '#/services/errorService';
import { logger } from '#/utils/environment';
import type { PaginationState } from '#hooks/types';

/**
 * Apollo `fetchMore` shape this hook invokes as `fetchMore({ variables })`.
 * The resolved value is never read — only whether the call settled — so it is
 * left as `unknown`.
 */
export type FetchMoreFn = (options: {
  variables?: OperationVariables;
}) => Promise<unknown>;

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
  fetchMore: FetchMoreFn;
  /** Additional variables to pass to fetchMore (e.g., id, filters) */
  fetchMoreVariables?: Record<string, unknown>;
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

/** Cursor pagination for any Apollo connection query exposing `pageInfo`. */
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

  // Serialization-compared, so an inline `fetchMoreVariables` object does not
  // recreate `loadMore` on every render.
  const fetchMoreVariablesRef = useRef(fetchMoreVariables);
  const serialized = JSON.stringify(fetchMoreVariables);
  const prevSerializedRef = useRef(serialized);
  useEffect(() => {
    if (prevSerializedRef.current !== serialized) {
      prevSerializedRef.current = serialized;
      fetchMoreVariablesRef.current = fetchMoreVariables;
    }
  });

  // Guards against two rapid `onEndReached` calls both reading `isFetchingMore`
  // as false before React batches the state update.
  const isFetchingMoreRef = useRef(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  // Released one frame AFTER the commit that appended the page. Clearing it in
  // that commit's effect phase re-opens `loadMore` while the page is still
  // mounting, and `endCursor` has already advanced — so the next `onEndReached`
  // of a fling starts page N+1 and two pages land together. The extra frame also
  // guarantees a render has published the new hasMore/endCursor first.
  useEffect(() => {
    if (isFetchingMore) return;
    const handle = requestAnimationFrame(() => {
      isFetchingMoreRef.current = false;
    });
    return () => cancelAnimationFrame(handle);
  }, [isFetchingMore]);

  const loadMore = async () => {
    // Don't load if:
    // - No more items to load
    // - Already loading
    // - No cursor available
    // - Already fetching more (ref checked synchronously)
    if (!hasMore || loading || !endCursor || isFetchingMoreRef.current) {
      if (__DEV__) {
        logger.debug(
          `📊 [Pagination] loadMore guarded: hasMore=${hasMore} loading=${loading} cursor=${!!endCursor} fetching=${
            isFetchingMoreRef.current
          }`,
        );
      }
      return;
    }

    isFetchingMoreRef.current = true;
    setIsFetchingMore(true);
    setLoadMoreError(false);

    let result;
    try {
      result = await fetchMore({
        variables: {
          ...fetchMoreVariablesRef.current,
          [cursorVariableName]: endCursor,
        },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'Pagination.loadMore' });
    }

    setIsFetchingMore(false);
    if (!result) {
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

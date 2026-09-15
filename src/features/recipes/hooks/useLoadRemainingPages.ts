import { useEffect } from 'react';
import type { ConnectionData } from '#hooks/utils/useConnectionData';

type PageState = Pick<
  ConnectionData<unknown>,
  'hasMore' | 'isLoadingMore' | 'loadMoreError' | 'loadMore'
>;

/**
 * Pages through the rest of a connection while `enabled`, for a filter the API
 * cannot run. Returns whether pages remain that have not failed to load.
 */
export function useLoadRemainingPages(
  enabled: boolean,
  loading: boolean,
  { hasMore, isLoadingMore, loadMoreError, loadMore }: PageState,
): boolean {
  // A failed page stops the loop; the local match keeps covering cached rows.
  const isLoadingRemainingPages = enabled && hasMore && !loadMoreError;
  const shouldLoadNextPage =
    isLoadingRemainingPages && !isLoadingMore && !loading;
  useEffect(() => {
    if (!shouldLoadNextPage) return;
    // `usePagination` releases its re-entry guard a frame after a page lands;
    // this frame is queued after that release, so the call is not swallowed.
    const handle = requestAnimationFrame(() => {
      void loadMore();
    });
    return () => cancelAnimationFrame(handle);
  }, [shouldLoadNextPage, loadMore]);

  return isLoadingRemainingPages;
}

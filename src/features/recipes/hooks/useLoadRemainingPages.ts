import { useEffect, useState } from 'react';
import type { ConnectionData } from '#hooks/utils/useConnectionData';

type PageState = Pick<
  ConnectionData<unknown>,
  'items' | 'hasMore' | 'isLoadingMore' | 'loadMoreError' | 'loadMore'
>;

/**
 * Consecutive settled pages that add no row before the loop stops. More than
 * one, because `loadMore` returns at once while its re-entry guard is still
 * set, and that looks exactly like a page that made no progress.
 */
const MAX_EMPTY_PAGES = 3;

/**
 * Pages through the rest of a connection while `enabled`, for a filter the API
 * cannot run. Returns whether pages remain that have not failed to load.
 */
export function useLoadRemainingPages(
  enabled: boolean,
  loading: boolean,
  { items, hasMore, isLoadingMore, loadMoreError, loadMore }: PageState,
): boolean {
  // The cache answering a cursor fetch while offline settles without adding a
  // row, forever; counting those stops the loop.
  const [emptyPages, setEmptyPages] = useState(0);
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  // Re-arms the effect after every settle: a request and its settle can land
  // in one render, leaving the effect's other dependencies unchanged.
  const [generation, setGeneration] = useState(0);
  const [wasEnabled, setWasEnabled] = useState(enabled);

  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (enabled) setEmptyPages(0);
  }
  if (settled && requestedAt !== null) {
    setSettled(false);
    setRequestedAt(null);
    setEmptyPages(items.length > requestedAt ? 0 : emptyPages + 1);
    setGeneration(generation + 1);
  }

  // A failed page stops the loop; the local match keeps covering cached rows.
  const isLoadingRemainingPages =
    enabled && hasMore && !loadMoreError && emptyPages < MAX_EMPTY_PAGES;
  const shouldLoadNextPage =
    isLoadingRemainingPages &&
    !isLoadingMore &&
    !loading &&
    requestedAt === null;
  const itemCount = items.length;
  useEffect(() => {
    if (!shouldLoadNextPage) return;
    // `usePagination` releases its re-entry guard a frame after a page lands;
    // this frame is queued after that release, so the call is not swallowed.
    const handle = requestAnimationFrame(() => {
      setRequestedAt(itemCount);
      void loadMore().then(() => {
        setSettled(true);
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [shouldLoadNextPage, loadMore, itemCount, generation]);

  return isLoadingRemainingPages;
}

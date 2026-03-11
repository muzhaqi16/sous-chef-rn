/**
 * usePantryQuery - Query hook for fetching pantry data
 *
 * Single responsibility:
 * - Fetch pantry with items
 * - Normalize data structure
 * - Handle pagination
 * - Preserve data during failures
 */

import { useState, useRef, useEffect } from 'react';
import {
  useGetPantryQuery,
  type PantryItemFilters,
  type PantryItemOrderBy,
} from '#generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { normalizePantry } from '#/utils/connectionUtils';
import { usePagination } from '#/hooks/utils/usePagination';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  usePreservedArrayData,
  usePreservedQueryData,
} from '#/hooks/apollo/usePreservedQueryData';
import {
  useAppStore,
  selectIsHomeSelectionReady,
  selectSetIsPantryQueryComplete,
} from '#store/useAppStore';
import { PAGE_SIZE } from '#/constants/pagination';

// Structural fingerprint: return stable array reference when item IDs + order are unchanged.
// Prevents unnecessary FlashList diffing when normalizePantry produces a new array object
// but the content is structurally identical.
let _pantryLastFingerprint = '';
let _pantryLastItems: any[] = [];

function stabilizePantryItems<T extends { id: string }>(
  items: T[] | undefined,
): T[] | undefined {
  if (!items || items.length === 0) return items;
  const fingerprint = items.map(i => i.id).join(',');
  if (
    fingerprint === _pantryLastFingerprint &&
    _pantryLastItems.length === items.length
  ) {
    return _pantryLastItems as T[];
  }
  _pantryLastFingerprint = fingerprint;
  _pantryLastItems = items;
  return items;
}

// Module-level helpers — outside hook body so React Compiler doesn't bail out on try-catch
async function executePantryRefetch(
  refetchFn: () => Promise<unknown>,
  setIsRefreshing: (v: boolean) => void,
) {
  setIsRefreshing(true);
  try {
    await refetchFn();
  } catch (error) {
    throw error;
  } finally {
    setIsRefreshing(false);
  }
}

async function executeAutoRefetch(
  refetchFn: () => Promise<unknown>,
  guard: React.RefObject<boolean>,
) {
  try {
    await refetchFn();
  } catch (error) {
    console.warn('[usePantryQuery] Auto-refetch failed:', error);
  } finally {
    guard.current = false;
  }
}

/**
 * Fetches pantry data with items, storage locations, and pagination.
 *
 * PERFORMANCE: Hardcoded policies prevent query cascade from network status changes.
 *
 * @param pantryId - The pantry to fetch
 * @param itemsFilter - Optional filter for pantry items
 * @param itemsOrderBy - Optional sort order for pantry items
 * @returns `{ state, actions }` — state contains pantryItems, storageLocations, stats,
 *   loading/error flags, and pagination indicators; actions contains refetch and loadMore
 */
export function usePantryQuery(
  pantryId: string | undefined,
  itemsFilter?: PantryItemFilters | null,
  itemsOrderBy?: PantryItemOrderBy | null,
) {
  const isLoggedOut = useIsLoggedOut();
  const isHomeSelectionReady = useAppStore(selectIsHomeSelectionReady);

  // Explicit validation - only execute query when pantryId is genuinely valid
  // Gate on isHomeSelectionReady to prevent queries with stale IDs after home deletion
  const hasValidPantryId =
    !!pantryId?.trim() && !isLoggedOut && isHomeSelectionReady;

  const { data, loading, error, refetch, fetchMore } = useGetPantryQuery({
    variables: {
      id: pantryId || '',
      itemsFirst: PAGE_SIZE.DEFAULT,
      itemsFilter: itemsFilter ?? undefined,
      itemsOrderBy: itemsOrderBy ?? undefined,
      storageLocationsFirst: PAGE_SIZE.COMPACT,
    },
    skip: !hasValidPantryId,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    // PERF: Removed notifyOnNetworkStatusChange to eliminate 2 extra re-renders
    // per mount (loading→ready transitions). Manual isRefreshing tracks pull-to-refresh instead.
    errorPolicy: 'ignore', // Return cached data on network errors
  });

  // Track pull-to-refresh state manually (replaces notifyOnNetworkStatusChange)
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Normalize pantry data to flatten Connection pattern
  const normalizedPantry = normalizePantry(data?.pantry);

  // Stabilize array reference when content is structurally identical
  const stableItems = stabilizePantryItems(normalizedPantry?.items);

  // Preserve pantry items across network failures
  const preservedItems = usePreservedArrayData(stableItems);

  // Filter out items that are pending deletion to prevent flicker
  const pantryItems = subscriptionService.filterPendingDeletes(preservedItems);

  // Pagination using generic utility hook
  const { hasMore, loadMore, isLoadingMore } = usePagination({
    pageInfo: normalizedPantry?.itemsPageInfo,
    loading,
    itemCount: pantryItems.length,
    fetchMore,
    fetchMoreVariables: {
      id: pantryId,
      itemsOrderBy: itemsOrderBy ?? undefined,
    },
    cursorVariableName: 'itemsCursor',
  });

  // Wrap refetch to track pull-to-refresh state
  const memoizedRefetch = () => executePantryRefetch(refetch, setIsRefreshing);

  // Guard to prevent multiple auto-refetches when edges are depleted
  const isAutoRefetchingRef = useRef(false);

  const pantryStorageLocations = usePreservedArrayData(
    normalizedPantry?.storageLocations,
  );

  const stats = usePreservedQueryData(
    normalizedPantry?.stats ?? undefined,
    null,
  );
  const totalCount = normalizedPantry?.itemsTotalCount ?? 0;

  const setIsPantryQueryComplete = useAppStore(selectSetIsPantryQueryComplete);

  // Signal to useDataPreloading that GetPantry has settled.
  // Fires on first load completion (cache hit or network response).
  // Resets when the query becomes invalid (logout / home switch) so the gate
  // re-arms if pantry queries restart.
  useEffect(() => {
    if (!loading && hasValidPantryId) {
      setIsPantryQueryComplete(true);
    }
    if (!hasValidPantryId) {
      setIsPantryQueryComplete(false);
    }
  }, [loading, hasValidPantryId, setIsPantryQueryComplete]);

  // DEV: log when pagination state changes for diagnosing blank frames / footer reappearance
  useEffect(() => {
    if (__DEV__) {
      console.log(
        `📊 [Pantry] hasMore=${hasMore} totalCount=${totalCount} items=${pantryItems.length}`,
      );
    }
  }, [hasMore, totalCount, pantryItems.length]);

  // Auto-refetch when edges are depleted but totalCount indicates items remain
  // (pagination edge depletion scenario — same pattern as usePaginatedShoppingItems)
  useEffect(() => {
    if (isAutoRefetchingRef.current || loading || !hasValidPantryId) {
      return;
    }

    if (totalCount > 0 && pantryItems.length === 0) {
      isAutoRefetchingRef.current = true;

      const idleId = requestIdleCallback(() =>
        executeAutoRefetch(refetch, isAutoRefetchingRef),
      );

      return () => {
        cancelIdleCallback(idleId);
        isAutoRefetchingRef.current = false;
      };
    }
  }, [totalCount, pantryItems.length, loading, hasValidPantryId, refetch]);

  return {
    state: {
      pantryItems,
      pantryStorageLocations,
      normalizedPantry,
      stats,
      totalCount,
      loading,
      isRefreshing,
      error,
      hasMore,
      isLoadingMore,
    },
    actions: {
      refetch: memoizedRefetch,
      loadMore,
    },
  };
}

/**
 * usePantryQuery - Query hook for fetching pantry data
 *
 * Single responsibility:
 * - Fetch pantry with items
 * - Normalize data structure
 * - Handle pagination
 * - Preserve data during failures
 */

import { useEffect } from 'react';
import { NetworkStatus } from '@apollo/client';
import {
  useGetPantryQuery,
  type PantryItemFilters,
  type PantryItemOrderBy,
} from '#generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { normalizePantry } from '#/utils/connectionUtils';
import { usePagination } from '#/hooks/utils/usePagination';
import {
  usePreservedArrayData,
  usePreservedQueryData,
} from '#/hooks/apollo/usePreservedQueryData';
import {
  useIsHomeSelectionReady,
  useSetIsPantryQueryComplete,
} from '#store/useAppStore';
import { PAGE_SIZE } from '#/constants/pagination';

// Structural fingerprint: return stable array reference when item IDs + content are unchanged.
// Prevents unnecessary FlashList diffing when normalizePantry produces a new array object
// but the content is structurally identical.
// Includes updatedAt in the fingerprint so subscription echoes with identical data
// return the stable reference, but genuine field changes propagate correctly.
let _pantryLastFingerprint = '';
let _pantryLastItems: any[] = [];

function stabilizePantryItems<
  T extends { id: string; updatedAt?: string | null },
>(items: T[] | undefined): T[] | undefined {
  if (!items || items.length === 0) return items;
  const fingerprint = items.map(i => `${i.id}:${i.updatedAt ?? ''}`).join(',');
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

/**
 * Fetches pantry data with items, storage locations, and pagination.
 *
 * The Apollo cache is the single source of truth:
 * - Mutations update `itemsConnection.edges` and `totalCount` together via
 *   `removeFromPantryItemsCache` / `addToPantryItemsCache`.
 * - Subscription echoes for pending-delete items are skipped at the
 *   subscription-handler level (`usePantrySubscriptions.ts`), so the cache
 *   never drifts from the rendered list.
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
  const isHomeSelectionReady = useIsHomeSelectionReady();

  // Explicit validation - only execute query when pantryId is genuinely valid
  // Gate on isHomeSelectionReady to prevent queries with stale IDs after home deletion
  const hasValidPantryId =
    !!pantryId?.trim() && !isLoggedOut && isHomeSelectionReady;

  const { data, loading, error, refetch, fetchMore, networkStatus } =
    useGetPantryQuery({
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
      errorPolicy: 'ignore', // Return cached data on network errors
      // Apollo emits a re-render when networkStatus transitions, so the
      // RefreshControl in PantryMain can observe pull-to-refresh state via
      // `isRefreshing` below.
      notifyOnNetworkStatusChange: true,
    });

  // Pull-to-refresh state — derived directly from Apollo's networkStatus.
  const isRefreshing = networkStatus === NetworkStatus.refetch;

  // Normalize pantry data to flatten Connection pattern
  const normalizedPantry = normalizePantry(data?.pantry);

  // Stabilize array reference when content is structurally identical
  const stableItems = stabilizePantryItems(normalizedPantry?.items);

  // Preserve pantry items across network failures — the cache is now the
  // single source of truth for which items exist, so no additional JS-layer
  // filtering (e.g. filterPendingDeletes) is needed.
  const pantryItems = usePreservedArrayData(stableItems);

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

  const pantryStorageLocations = usePreservedArrayData(
    normalizedPantry?.storageLocations,
  );

  const stats = usePreservedQueryData(
    normalizedPantry?.stats ?? undefined,
    null,
  );
  const totalCount = normalizedPantry?.itemsTotalCount ?? 0;

  const setIsPantryQueryComplete = useSetIsPantryQueryComplete();

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
      refetch,
      loadMore,
    },
  };
}

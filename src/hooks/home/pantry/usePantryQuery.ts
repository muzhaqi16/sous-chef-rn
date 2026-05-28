/**
 * usePantryQuery - Query hook for fetching pantry data
 *
 * Single responsibility:
 * - Fetch pantry with items
 * - Normalize data structure
 * - Handle pagination
 * - Preserve data during failures
 */

import { useEffect, useState } from 'react';
import { NetworkStatus } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import {
  GetPantryDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import type {
  PantryItemFilters,
  PantryItemOrderBy,
} from '#/graphql/generated/schemaTypes';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { extractNodes, getConnectionTotalCount } from '#/utils/connectionUtils';
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

/**
 * Type of each pantry item node returned by `usePantryQuery`. It mirrors the
 * `GetPantry` query selection: direct fields the screen-level hooks need plus
 * an opaque `PantryItemCard_pantryItem` fragment ref that the leaf cell
 * unmasks via `useFragment`.
 */
export type PantryListItemNode = NonNullable<
  NonNullable<GetPantryQuery['pantry']>['itemsConnection']['edges'][number]
>['node'];

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

  // ── Query activation latch ──
  // During startup initialization, upstream state churn (isHomeSelectionReady,
  // selectedHomeId) can cause hasValidPantryId to flicker. Each skip toggle
  // (true→false) resets Apollo's fetchPolicy to the initial cache-and-network,
  // firing a duplicate network request.
  //
  // Once the query activates for a given pantryId, latch it active so transient
  // state changes don't re-skip it. The latch auto-resets when:
  //  • pantryId changes (user switches pantries → fresh fetch needed)
  //  • user logs out (query must stop)
  //
  // Uses "adjusting state during render" pattern (no ref.current reads).
  const [activatedForId, setActivatedForId] = useState<string | null>(null);

  // Latch: once validation passes for this pantryId, keep the query active
  if (hasValidPantryId && pantryId && activatedForId !== pantryId) {
    setActivatedForId(pantryId);
  }

  // Release: on logout, clear the latch so the query skips
  if (activatedForId && isLoggedOut) {
    setActivatedForId(null);
  }

  // The query should run when EITHER:
  // 1. hasValidPantryId is currently true (normal path), OR
  // 2. We previously activated for this exact pantryId (latch prevents flickering)
  const isLatched = activatedForId === pantryId && !!pantryId;
  const shouldSkip = !hasValidPantryId && !isLatched;

  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetPantryDocument,
    {
      variables: {
        id: pantryId || '',
        itemsFirst: PAGE_SIZE.DEFAULT,
        itemsFilter: itemsFilter ?? undefined,
        itemsOrderBy: itemsOrderBy ?? undefined,
        storageLocationsFirst: PAGE_SIZE.COMPACT,
      },
      skip: shouldSkip,
      // After the initial network fetch, use cache-first for re-renders to avoid
      // duplicate requests. On variable changes (filter/sort), revert to the
      // initial policy so the user gets fresh data.
      nextFetchPolicy(currentFetchPolicy, context) {
        if (context.reason === 'variables-changed') {
          return context.initialFetchPolicy;
        }
        return 'cache-first';
      },
      errorPolicy: 'ignore', // Return cached data on network errors
      // Apollo emits a re-render when networkStatus transitions, so the
      // RefreshControl in PantryMain can observe pull-to-refresh state via
      // `isRefreshing` below.
      notifyOnNetworkStatusChange: true,
    },
  );

  // Pull-to-refresh state — derived directly from Apollo's networkStatus.
  const isRefreshing = networkStatus === NetworkStatus.refetch;

  const pantry = data?.pantry;
  const itemsConnection = pantry?.itemsConnection;
  const storageLocationsConnection = pantry?.storageLocationsConnection;

  // Pass connection edges through as opaque fragment refs — each leaf cell
  // unmasks its own slice via `useFragment` inside `PantryItemCard`. The
  // parent operation also selects screen-level fields (id, itemName,
  // quantity, expiresAt, storageState, storageLocation.id, createdAt,
  // updatedAt, isLowStock) directly on each node, so local sort/search and
  // hook logic don't need to materialize.
  const pantryItems = usePreservedArrayData(extractNodes(itemsConnection));

  // Pagination using generic utility hook
  const { hasMore, loadMore, isLoadingMore } = usePagination({
    pageInfo: itemsConnection?.pageInfo ?? undefined,
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
    extractNodes(storageLocationsConnection),
  );

  const stats = usePreservedQueryData(pantry?.stats ?? undefined, null);
  const totalCount = getConnectionTotalCount(itemsConnection);

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

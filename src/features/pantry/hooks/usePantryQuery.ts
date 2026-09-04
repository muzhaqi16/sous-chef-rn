import { useEffect, useState } from 'react';
import { NetworkStatus } from '@apollo/client';
import type { WatchQueryFetchPolicy } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { logger } from '#/utils/environment';
import {
  GetPantryDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import type {
  PantryItemFilters,
  PantryItemOrderBy,
} from '#/graphql/generated/schemaTypes';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { usePagination } from '#/hooks/utils/usePagination';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { usePreservedConnection } from '#/hooks/apollo/usePreservedConnection';
import {
  useIsHomeSelectionReady,
  useSetIsPantryQueryComplete,
} from '#store/useAppStore';
import { PAGE_SIZE } from '#features/pantry/constants/pagination';

/**
 * Direct fields the screen-level hooks need, plus an opaque
 * `PantryItemCard_pantryItem` ref the leaf cell unmasks via `useFragment`.
 */
export type PantryListItemNode = NonNullable<
  NonNullable<GetPantryQuery['pantry']>['itemsConnection']['edges'][number]
>['node'];

/**
 * A secondary consumer on another tab stands its watcher down while blurred via
 * `skip`, and must pair that with `fetchPolicy: 'cache-first'`: Apollo resets a
 * re-enabled query to its INITIAL policy, so toggling `skip` alone pays a
 * `cache-and-network` round-trip on every focus.
 */
export interface PantryQueryOptions {
  skip?: boolean;
  fetchPolicy?: WatchQueryFetchPolicy;
}

export function usePantryQuery(
  pantryId: string | undefined,
  itemsFilter?: PantryItemFilters | null,
  itemsOrderBy?: PantryItemOrderBy | null,
  // Defaults to the API max so a typical pantry arrives in one page, making
  // client-side sort/filter/search instant.
  itemsFirst: number = PAGE_SIZE.MAX,
  options?: PantryQueryOptions,
) {
  const isLoggedOut = useIsLoggedOut();
  const isHomeSelectionReady = useIsHomeSelectionReady();

  // Explicit validation - only execute query when pantryId is genuinely valid
  // Gate on isHomeSelectionReady to prevent queries with stale IDs after home deletion
  const hasValidPantryId =
    !!pantryId?.trim() && !isLoggedOut && isHomeSelectionReady;

  // Activation latch: startup churn in isHomeSelectionReady/selectedHomeId makes
  // hasValidPantryId flicker, and each skip toggle resets Apollo's fetchPolicy to
  // cache-and-network, firing a duplicate request. Latched per pantryId, released
  // on logout, via adjusting-state-during-render (no ref.current reads).
  const [activatedForId, setActivatedForId] = useState<string | null>(null);

  // Latch: once validation passes for this pantryId, keep the query active
  if (hasValidPantryId && pantryId && activatedForId !== pantryId) {
    setActivatedForId(pantryId);
  }

  // Release: on logout, clear the latch so the query skips
  if (activatedForId && isLoggedOut) {
    setActivatedForId(null);
  }

  // Runs when validation passes OR the latch already holds this pantryId. The
  // latch deliberately does not override `options.skip` — that is the consumer's
  // own decision to stand down.
  const isLatched = activatedForId === pantryId && !!pantryId;
  const shouldSkip =
    (!hasValidPantryId && !isLatched) || options?.skip === true;

  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetPantryDocument,
    {
      variables: {
        id: pantryId || '',
        itemsFirst,
        itemsFilter: itemsFilter ?? undefined,
        itemsOrderBy: itemsOrderBy ?? undefined,
        storageLocationsFirst: PAGE_SIZE.COMPACT,
      },
      skip: shouldSkip,
      ...(options?.fetchPolicy ? { fetchPolicy: options.fetchPolicy } : {}),
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

  // Preserve the connections BEFORE extracting nodes: under `errorPolicy:
  // 'ignore'` a transient failure surfaces `data === undefined` even though the
  // persisted cache holds the items, and extracting first flattens that to `[]`,
  // wiping list, count and pagination state.
  const items = usePreservedConnection(pantry?.itemsConnection);
  const storageLocations = usePreservedConnection(
    pantry?.storageLocationsConnection,
  );

  const pantryItems = items.nodes;

  // Pagination using generic utility hook
  const { hasMore, loadMore, isLoadingMore } = usePagination({
    pageInfo: items.pageInfo,
    loading,
    itemCount: pantryItems.length,
    fetchMore,
    fetchMoreVariables: {
      id: pantryId,
      itemsOrderBy: itemsOrderBy ?? undefined,
    },
    cursorVariableName: 'itemsCursor',
  });

  const pantryStorageLocations = storageLocations.nodes;

  const stats = usePreservedQueryData(pantry?.stats ?? undefined, null);
  const totalCount = items.totalCount ?? 0;

  const setIsPantryQueryComplete = useSetIsPantryQueryComplete();

  // Signals useDataPreloading that GetPantry has settled; resets on logout /
  // home switch so the gate re-arms when pantry queries restart.
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
      logger.debug(
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
      // `errorPolicy: 'ignore'` leaves `data === undefined` on failure, but a
      // preserved connection still counts as an answer — hence not `!!data`.
      hasResult: data !== undefined || items.pageInfo !== undefined,
      // No pantry to ask about yet — the same predicate given to `skip` above,
      // so a screen classifying this cannot mistake "not asked" for "failed".
      skipped: shouldSkip,
      hasMore,
      isLoadingMore,
    },
    actions: {
      refetch,
      loadMore,
    },
  };
}

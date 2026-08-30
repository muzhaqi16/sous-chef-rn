import { useEffect, useRef } from 'react';
import { gql, type ApolloCache } from '@apollo/client';
import { useApolloClient, useLazyQuery } from '@apollo/client/react';
import { safeEvictMany } from '#/apollo/utils/cacheUpdaters';
import { GetHomesDocument } from '#operations/home/home.generated';
import {
  usePantryState,
  useIsHomeSelectionReady,
  useSetIsHomeSelectionReady,
  useIsLoggingOut,
  useAppStore,
} from '#store/useAppStore';
import { useStore } from '#store';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';
import { useMarkHomeAsDefault } from '#features/home/hooks/useMarkHomeAsDefault';
import { isDefaultHomeSyncPending } from '#features/home/store/useDefaultHomeSyncStore';
import { handleMutationError } from '#/utils/errorHandlers';
import {
  pantriesOf,
  defaultPantryOf,
  type HomePantries,
} from '#features/home/utils/homePantries';
import { logger } from '#/utils/environment';

/**
 * Narrow on purpose: a `readQuery` of the whole `GetHomes` document is
 * all-or-nothing, so one unrelated evicted record makes the check unanswerable.
 */
const SELECTED_HOME_PANTRIES = gql`
  fragment SelectedHomePantries_home on Home {
    id
    pantriesConnection {
      totalCount
      edges {
        node {
          id
        }
      }
    }
  }
`;

/** What the fragment above reads back. */
type SelectedHomePantries = {
  pantriesConnection?: {
    totalCount?: number | null;
    edges?: Array<{ node?: { id: string } | null } | null> | null;
  } | null;
};

/**
 * True only when the cached connection holds the whole set. `GetHomes` pages
 * pantries at `first: 10`, so absence from a partial page proves nothing.
 */
const isConnectionComplete = (connection: {
  totalCount?: number | null;
  edges?: readonly unknown[] | null;
}) =>
  typeof connection.totalCount === 'number' &&
  (connection.edges?.length ?? 0) === connection.totalCount;

/** The three answers a validation can have. `unknown` is not `invalid`. */
type SelectionCheck = 'valid' | 'invalid' | 'unknown';

/**
 * Adopts the pantry the server names, and reports a failed sync — a new user
 * left with no default home is invisible otherwise.
 */
const syncAsAccountDefault = (
  markAsDefault: ReturnType<typeof useMarkHomeAsDefault>['markAsDefault'],
  setSelectedPantryId: (id: string | null) => void,
  homeId: string,
  localPantryId: string | null,
) => {
  void markAsDefault(homeId).then(({ status, serverPantry }) => {
    if (status === 'confirmed' && serverPantry?.id) {
      setSelectedPantryId(serverPantry.id);
      return;
    }
    if (status === 'refused' || status === 'failed') {
      handleMutationError(new Error(`markHomeAsDefault ${status}`), {
        operation: 'Set First Home as Default',
        showAlert: false,
      });
      if (localPantryId) setSelectedPantryId(localPantryId);
    }
  });
};

/** `unknown` when the cache holds too little to convict the selection. */
const checkPantryBelongsToHome = (
  cache: ApolloCache,
  homeId: string,
  pantryId: string,
): SelectionCheck => {
  const cacheId = cache.identify({ __typename: 'Home', id: homeId });
  const home =
    cacheId &&
    cache.readFragment<SelectedHomePantries>({
      id: cacheId,
      fragment: SELECTED_HOME_PANTRIES,
    });

  const connection = home ? home.pantriesConnection : null;
  if (!connection) return 'unknown';
  if (!isConnectionComplete(connection)) return 'unknown';

  return (connection.edges ?? []).some(edge => edge?.node?.id === pantryId)
    ? 'valid'
    : 'invalid';
};

/**
 * Manages home selection, default home resolution, and pantry ID tracking.
 *
 * @returns `{ state, actions }` — home/pantry selection state and helpers like getDefaultPantry
 */
export const useDefaultHome = () => {
  const client = useApolloClient();
  const {
    selectedHomeId,
    setSelectedHomeId,
    selectedPantryId,
    setSelectedPantryId,
  } = usePantryState();
  const canAttemptQueries = useAppStore(
    state => !!(state.accessToken || state.refreshToken) && !state.isLoggingOut,
  );

  // Track if we've already initialized defaults to prevent cascading re-renders
  const hasInitializedRef = useRef(false);
  // Track if we've already triggered auto-select for first home
  const hasAutoSelectedRef = useRef(false);

  // Track logout state to reset refs when user logs out
  const isLoggingOut = useIsLoggingOut();
  const wasLoggingOutRef = useRef(false);

  // Reset refs when logout starts
  useEffect(() => {
    if (isLoggingOut && !wasLoggingOutRef.current) {
      // Logout just started - reset refs so next login gets fresh data
      hasInitializedRef.current = false;
      hasAutoSelectedRef.current = false;
      logger.debug('🔄 Reset useDefaultHome refs on logout');
    }
    wasLoggingOutRef.current = isLoggingOut;
  }, [isLoggingOut]);

  // Home selection ready state - gates pantry queries
  const isHomeSelectionReady = useIsHomeSelectionReady();
  const setIsHomeSelectionReady = useSetIsHomeSelectionReady();

  const { markAsDefault } = useMarkHomeAsDefault();

  // PERFORMANCE: Use lazy queries with STABLE options to control when they execute
  // Using hardcoded 'cache-first' instead of dynamic policy prevents function recreation
  // on network status changes which caused query cascades
  const [
    getHomes,
    { data: homes, loading, error, called, refetch: refetchHomes },
  ] = useLazyQuery(GetHomesDocument, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  // Opens the pantry query in parallel with GetHomes when the persisted pair
  // still checks out against the synchronously restored cache. `unknown` takes
  // no shortcut and repairs nothing — the ready effect below re-answers it once
  // GetHomes lands.
  useEffect(() => {
    if (
      !canAttemptQueries ||
      !selectedHomeId ||
      !selectedPantryId ||
      isHomeSelectionReady
    ) {
      return;
    }

    if (
      checkPantryBelongsToHome(
        client.cache,
        selectedHomeId,
        selectedPantryId,
      ) !== 'valid'
    ) {
      return;
    }

    logger.debug('⚡ Early ready: using persisted home/pantry IDs');
    setIsHomeSelectionReady(true);
  }, [
    canAttemptQueries,
    selectedHomeId,
    selectedPantryId,
    isHomeSelectionReady,
    setIsHomeSelectionReady,
    client,
  ]);

  // Execute query ONCE when authenticated to populate Apollo cache
  // This runs on every app startup (hasInitializedHomeData resets) to ensure
  // the cache has home data, even if selectedHomeId is already persisted
  // PERF: Read hasInitializedHomeData non-reactively to avoid triggering a full
  // re-render of PantryMainScreen when this flag changes (false→true)
  useEffect(() => {
    const {
      hasInitializedHomeData: hasInitialized,
      setHasInitializedHomeData,
    } = useStore.getState();
    if (canAttemptQueries && !hasInitialized) {
      setHasInitializedHomeData(true);
      // Logout calls client.clearStore(), so on a fresh login this cache-first
      // read misses and fetches from the network (fresh data for the new user);
      // on a same-user cold start it paints instantly from the persisted cache.
      getHomes();
    }
  }, [canAttemptQueries, getHomes]);

  // Preserve homes data even when query fails - prevents cascade failures.
  // Each node carries `id`, `isDefault`, `myMembership`, and
  // `pantriesConnection` from the operation plus a masked `HomeCard_home`
  // ref. Pantry lookups read the connection nodes via `extractNodes`.
  const homesList = usePreservedNodes(homes?.homes);

  type HomeNode = (typeof homesList)[number] & {
    pantriesConnection?: {
      edges?: Array<{ node?: { id: string; isDefault?: boolean } }>;
    };
  };

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = homesList?.find(h => h.isDefault)?.id ?? null;

  // Extract default pantry ID (React Compiler auto-memoizes this derivation)
  const defaultPantryId = (() => {
    const defaultHome = homesList?.find(h => h.isDefault) as
      | HomeNode
      | undefined;
    const pantries = pantriesOf(defaultHome);
    if (!pantries.length) return null;
    const defaultPantry = pantries.find(p => p.isDefault) ?? pantries[0];
    return defaultPantry?.id || null;
  })();

  // Validate that selectedHomeId still exists in the homes list
  const isSelectedHomeValid = (() => {
    if (!selectedHomeId || !homesList || homesList.length === 0) return false;
    return homesList.some(h => h.id === selectedHomeId);
  })();

  // The selected PANTRY must belong to the selected HOME.
  //
  // `selectedPantryId` is persisted alongside `selectedHomeId`, so a cold start
  // can restore a pantry from a home the user has since left, been removed
  // from, or deleted. `needsClearing` above only validates the home, and the
  // ready flag below flips on a valid home alone — which opens `usePantryQuery`'s
  // gate on the stale id and sends `GetPantry` for a pantry the user cannot
  // read ("Access denied to this pantry"). `useCurrentPantry` repoints it, but
  // one render too late: the request is already in flight.
  //
  // Judged only against a connection known to be complete: an empty list means
  // "not loaded", and a page means "not on this page".
  const selectedHome = homesList?.find(h => h.id === selectedHomeId) as
    | HomeNode
    | undefined;
  const selectedHomePantries = pantriesOf(selectedHome);
  const selectedHomeHasCompletePantries = !!(
    selectedHome?.pantriesConnection &&
    isConnectionComplete(selectedHome.pantriesConnection)
  );
  const isSelectedPantryStale = !!(
    selectedPantryId &&
    isSelectedHomeValid &&
    selectedHomeHasCompletePantries &&
    !selectedHomePantries.some(p => p.id === selectedPantryId)
  );

  // Derived boolean: true when selected home no longer exists and needs clearing
  const needsClearing = !!(
    selectedHomeId &&
    homesList &&
    homesList.length > 0 &&
    !isSelectedHomeValid
  );

  // Clear stale selectedHomeId if home was deleted while app was in background
  // Also reset ready state to force re-initialization
  useEffect(() => {
    if (needsClearing) {
      logger.warn(
        '[HomeSelector] Selected home no longer exists, clearing selection',
      );

      // Evict stale Home and Pantry entities from Apollo cache
      // This prevents cache-only queries from returning deleted entities
      const itemsToEvict: Array<{ typename: string; id: string }> = [
        { typename: 'Home', id: selectedHomeId },
      ];
      if (selectedPantryId) {
        itemsToEvict.push({ typename: 'Pantry', id: selectedPantryId });
      }
      safeEvictMany(client.cache, itemsToEvict);

      setSelectedHomeId(null);
      setSelectedPantryId(null);
      setIsHomeSelectionReady(false);
      hasInitializedRef.current = false;
      hasAutoSelectedRef.current = false;
    }
  }, [
    needsClearing,
    selectedHomeId,
    selectedPantryId,
    setSelectedHomeId,
    setSelectedPantryId,
    setIsHomeSelectionReady,
    client,
  ]);

  // Repointed, never evicted: a pantry outside the selected home is usually a
  // live pantry of another home, and evicting it drops the edge from THAT
  // home's connection too (the self-healing read in `mergeConnectionByNodeId`).
  // Eviction stays with `needsClearing`, where the server has confirmed the
  // home is gone. The gate is lowered rather than withheld so a mid-session
  // removal closes an already-open gate.
  const staleSelectedPantryId = isSelectedPantryStale ? selectedPantryId : null;
  useEffect(() => {
    if (!staleSelectedPantryId) return;
    logger.warn(
      '[HomeSelector] Selected pantry does not belong to the selected home, repointing',
    );
    setIsHomeSelectionReady(false);
    setSelectedPantryId(defaultPantryOf(selectedHome)?.id ?? null);
  }, [
    staleSelectedPantryId,
    selectedHome,
    setSelectedPantryId,
    setIsHomeSelectionReady,
  ]);

  // Complementary case to `needsClearing` above: a home is selected but the
  // list came back EMPTY, so there is nothing to validate it against. That
  // happens when the single fetch above ran before the home existed —
  // onboarding creates the home after it, and no other screen refills this
  // connection — leaving every consumer that resolves the home from the cached
  // list (PantryMain's header, pantry permissions) on its "no home" fallback
  // for the rest of the session. Refetch once per selected home; a list that is
  // genuinely empty stays empty without re-triggering.
  const hasSelectionButNoHomes = !!(
    called &&
    !loading &&
    selectedHomeId &&
    homesList.length === 0
  );
  const refetchedForHomeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasSelectionButNoHomes || !selectedHomeId) return;
    if (refetchedForHomeIdRef.current === selectedHomeId) return;
    refetchedForHomeIdRef.current = selectedHomeId;
    logger.debug(
      '🏠 Selected home missing from an empty homes list, refetching:',
      selectedHomeId,
    );
    refetchHomes().catch(() => {
      logger.warn('Failed to refetch homes for selected home');
    });
  }, [hasSelectionButNoHomes, selectedHomeId, refetchHomes]);

  // Sync remote defaults to local store (one-time initialization)
  // CONSOLIDATED: Both home and pantry are set in a single effect to prevent
  // cascading re-renders that cause duplicate queries
  useEffect(() => {
    // Skip if already initialized
    if (hasInitializedRef.current) return;

    // Wait for remote data to be available
    if (!remoteDefaultHomeId) return;

    let didUpdate = false;

    // Restore home to remote default if not set or if it differs
    // (e.g., invitation acceptance sets a non-default home that shouldn't persist across restarts)
    if (!selectedHomeId || selectedHomeId !== remoteDefaultHomeId) {
      setSelectedHomeId(remoteDefaultHomeId);
      didUpdate = true;
      logger.debug('🏠 Auto-selected default home:', remoteDefaultHomeId);
    }

    // When home changed, always sync pantry (old pantry belongs to old home).
    // When home already correct, fill in pantry only if missing.
    if (didUpdate && defaultPantryId) {
      setSelectedPantryId(defaultPantryId);
      logger.debug('🏠 Auto-selected default pantry:', defaultPantryId);
    } else if (!selectedPantryId && defaultPantryId) {
      setSelectedPantryId(defaultPantryId);
      didUpdate = true;
      logger.debug('🏠 Auto-selected default pantry:', defaultPantryId);
    }

    // Mark as initialized once we've processed
    // Either we made updates, or selections already exist
    if (
      didUpdate ||
      (selectedHomeId && (selectedPantryId || !defaultPantryId))
    ) {
      hasInitializedRef.current = true;
    }
  }, [
    remoteDefaultHomeId,
    defaultPantryId,
    selectedHomeId,
    selectedPantryId,
    setSelectedHomeId,
    setSelectedPantryId,
  ]);

  // AUTO-SELECT FIRST HOME: homes exist but none is the account default.
  useEffect(() => {
    if (hasAutoSelectedRef.current || loading || !called) return;
    if (!homesList || homesList.length === 0 || selectedHomeId) return;
    // A default written locally but not yet confirmed does not count as the
    // server having one.
    if (remoteDefaultHomeId && !isDefaultHomeSyncPending(remoteDefaultHomeId)) {
      return;
    }

    const firstHome = homesList[0] as HomeNode;
    logger.debug('🏠 Auto-selecting first home:', firstHome.id);

    hasAutoSelectedRef.current = true;
    setSelectedHomeId(firstHome.id);

    const localDefaultPantry = defaultPantryOf(firstHome);
    if (localDefaultPantry?.id && !selectedPantryId) {
      setSelectedPantryId(localDefaultPantry.id);
    }

    syncAsAccountDefault(
      markAsDefault,
      setSelectedPantryId,
      firstHome.id,
      localDefaultPantry?.id ?? null,
    );

    hasInitializedRef.current = true;
  }, [
    loading,
    called,
    homesList,
    selectedHomeId,
    selectedPantryId,
    remoteDefaultHomeId,
    setSelectedHomeId,
    setSelectedPantryId,
    markAsDefault,
  ]);

  // FIRST HOME VIA INVITATION: a single home is selected but is not the
  // account default, which is what accepting a first invitation leaves behind.
  useEffect(() => {
    if (!homesList || homesList.length !== 1) return;
    if (!selectedHomeId || selectedHomeId !== homesList[0].id) return;
    if (remoteDefaultHomeId && !isDefaultHomeSyncPending(remoteDefaultHomeId)) {
      return;
    }
    if (loading || !called) return;

    logger.debug('🏠 Syncing first home as account default:', selectedHomeId);
    syncAsAccountDefault(
      markAsDefault,
      setSelectedPantryId,
      selectedHomeId,
      null,
    );
  }, [
    homesList,
    selectedHomeId,
    remoteDefaultHomeId,
    loading,
    called,
    markAsDefault,
    setSelectedPantryId,
  ]);

  // SET HOME SELECTION READY: Only when initialization is truly complete
  // This gates pantry queries to prevent race conditions
  useEffect(() => {
    // Don't update if query hasn't been called yet
    if (!called) return;

    // Don't update while loading
    if (loading) return;

    // Don't update while clearing stale IDs (wait for state to propagate)
    if (needsClearing) return;

    // Same for a pantry that outlived its home: flipping ready here is what
    // lets `usePantryQuery` fire on it.
    if (isSelectedPantryStale) return;

    // Case 1: no homes. `errorPolicy: 'ignore'` makes "no homes" and "the list
    // failed to load" the same empty array, so a selection that this list
    // cannot convict waits for the refetch below to settle — and no longer.
    if (!homesList || homesList.length === 0) {
      // Nothing can validate a pantry with no home, and `usePantryQuery` gates
      // on this flag alone.
      if (selectedPantryId && !selectedHomeId) {
        logger.warn(
          '[HomeSelector] Pantry selected with no home, clearing before ready',
        );
        setSelectedPantryId(null);
        return;
      }

      if (selectedHomeId) {
        const refetchSettled =
          refetchedForHomeIdRef.current === selectedHomeId && !loading;
        if (!refetchSettled) return;
      }

      if (!isHomeSelectionReady) {
        setIsHomeSelectionReady(true);
      }
      return;
    }

    // Case 2: Valid home is selected - ready
    const hasValidSelection =
      selectedHomeId && homesList.some(h => h.id === selectedHomeId);
    if (hasValidSelection) {
      if (!isHomeSelectionReady) {
        setIsHomeSelectionReady(true);
      }
      return;
    }

    // Case 3: Homes exist but none selected yet - wait for auto-selection
    // Don't set ready yet, let the auto-select effects run first
  }, [
    called,
    loading,
    homesList,
    selectedHomeId,
    selectedPantryId,
    isHomeSelectionReady,
    needsClearing,
    isSelectedPantryStale,
    setIsHomeSelectionReady,
    setSelectedPantryId,
  ]);

  // Recovery: if ready but no home selected and homes exist, allow auto-select retry
  useEffect(() => {
    if (
      isHomeSelectionReady &&
      !selectedHomeId &&
      homesList &&
      homesList.length > 0 &&
      !remoteDefaultHomeId &&
      !needsClearing
    ) {
      hasAutoSelectedRef.current = false;
    }
  }, [
    isHomeSelectionReady,
    selectedHomeId,
    homesList,
    remoteDefaultHomeId,
    needsClearing,
  ]);

  // Callers holding a `{ home }` query result pass `result.home`.
  const getDefaultPantry = (home: HomePantries | null | undefined) =>
    defaultPantryOf(home ?? undefined) ?? null;

  // Provide the most appropriate home ID (prefer Zustand store, fallback to remote default)
  // This ensures instant UI updates after mutations while still syncing from server on initial load
  const currentHomeId = selectedHomeId ?? remoteDefaultHomeId;

  return {
    state: {
      selectedHomeId: currentHomeId,
      homes: homesList,
      loading,
      error,
      hasDefaultHome: !!currentHomeId,
      remoteDefaultHomeId,
      selectedPantryId,
      isHomeSelectionReady,
    },
    actions: {
      getDefaultPantry,
      setSelectedPantryId,
    },
  };
};

import { useEffect, useRef } from 'react';
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
} from '@apollo/client/react';
import { safeEvictMany } from '#/apollo/utils/cacheUpdaters';
import { GetHomesDocument } from '#operations/home/home.generated';
import { SetDefaultHomeDocument } from '#operations/home/userSettings.generated';
import {
  usePantryState,
  useIsHomeSelectionReady,
  useSetIsHomeSelectionReady,
  useIsLoggingOut,
  useAppStore,
} from '#store/useAppStore';
import { useStore } from '#store';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';
import { extractNodes } from '#/utils/connectionUtils';

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
      console.log('🔄 Reset useDefaultHome refs on logout');
    }
    wasLoggingOutRef.current = isLoggingOut;
  }, [isLoggingOut]);

  // Home selection ready state - gates pantry queries
  const isHomeSelectionReady = useIsHomeSelectionReady();
  const setIsHomeSelectionReady = useSetIsHomeSelectionReady();

  // SetDefaultHome mutation for syncing auto-selection to server
  const [setDefaultHomeMutation] = useMutation(SetDefaultHomeDocument, {});

  // PERFORMANCE: Use lazy queries with STABLE options to control when they execute
  // Using hardcoded 'cache-first' instead of dynamic policy prevents function recreation
  // on network status changes which caused query cascades
  const [getHomes, { data: homes, loading, error, called }] = useLazyQuery(
    GetHomesDocument,
    {
      fetchPolicy: 'cache-first',
      errorPolicy: 'ignore',
    },
  );

  // Allow pantry query to start immediately when persisted selections exist.
  // This runs in parallel with GetHomes instead of waiting for selection init.
  useEffect(() => {
    if (
      canAttemptQueries &&
      selectedHomeId &&
      selectedPantryId &&
      !isHomeSelectionReady
    ) {
      console.log('⚡ Early ready: using persisted home/pantry IDs');
      setIsHomeSelectionReady(true);
    }
  }, [
    canAttemptQueries,
    selectedHomeId,
    selectedPantryId,
    isHomeSelectionReady,
    setIsHomeSelectionReady,
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
      // Pass network-only override to bypass cache on login
      // This ensures we get fresh data for the new user, not cached data from previous user
      // Type assertion needed because generated types are overly strict for queries with no variables
      // Apollo docs confirm fetchPolicy is valid: https://www.apollographql.com/docs/react/api/react/hooks#uselazyquery
      (getHomes as (options?: { fetchPolicy?: string }) => void)({
        fetchPolicy: 'network-only',
      });
    }
  }, [canAttemptQueries, getHomes]);

  // Preserve homes data even when query fails - prevents cascade failures.
  // Each node carries `id`, `isDefault`, `myMembership`, and
  // `pantriesConnection` from the operation plus a masked `HomeCard_home`
  // ref. Pantry lookups read the connection nodes via `extractNodes`.
  const homesList = usePreservedArrayData(extractNodes(homes?.homes));

  type HomeNode = (typeof homesList)[number] & {
    pantriesConnection?: {
      edges?: Array<{ node?: { id: string; isDefault?: boolean } }>;
    };
  };

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = homesList?.find(h => h.isDefault)?.id ?? null;

  const pantriesOf = (home: HomeNode | undefined) => {
    if (!home) return [];
    const fromConnection = extractNodes(home.pantriesConnection) as Array<{
      id: string;
      isDefault?: boolean;
    }>;
    if (fromConnection.length) return fromConnection;
    // Legacy callers (e.g. tests, residual callers passing the old flat shape
    // from before view-model removal) hand in `{ pantries: [...] }`. Accept it.
    const flat = (home as { pantries?: unknown }).pantries;
    return Array.isArray(flat)
      ? (flat as Array<{ id: string; isDefault?: boolean }>)
      : [];
  };

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
      console.warn(
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
      console.log('🏠 Auto-selected default home:', remoteDefaultHomeId);
    }

    // When home changed, always sync pantry (old pantry belongs to old home).
    // When home already correct, fill in pantry only if missing.
    if (didUpdate && defaultPantryId) {
      setSelectedPantryId(defaultPantryId);
      console.log('🏠 Auto-selected default pantry:', defaultPantryId);
    } else if (!selectedPantryId && defaultPantryId) {
      setSelectedPantryId(defaultPantryId);
      didUpdate = true;
      console.log('🏠 Auto-selected default pantry:', defaultPantryId);
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

  // AUTO-SELECT FIRST HOME: When no server default exists but homes are available
  // This handles the case where user has homes but none is marked as default
  useEffect(() => {
    // Skip if already auto-selected or query not complete
    if (hasAutoSelectedRef.current || loading || !called) return;

    // Skip if there are no homes or a home is already selected
    if (!homesList || homesList.length === 0 || selectedHomeId) return;

    // Skip if server has a default (will be handled by the other effect)
    if (remoteDefaultHomeId) return;

    // Auto-select first home
    const firstHome = homesList[0] as HomeNode;
    console.log(
      '🏠 No default home on server, auto-selecting first home:',
      firstHome.id,
    );

    hasAutoSelectedRef.current = true;
    setSelectedHomeId(firstHome.id);

    // Set pantry immediately from local data (mutation will confirm/update later)
    const firstHomePantries = pantriesOf(firstHome);
    const localDefaultPantry =
      firstHomePantries.find(p => p.isDefault) ?? firstHomePantries[0];
    if (localDefaultPantry?.id && !selectedPantryId) {
      setSelectedPantryId(localDefaultPantry.id);
    }

    // Sync to server - set this home as the default
    // The mutation returns the default pantry, which we use to set selectedPantryId
    setDefaultHomeMutation({
      variables: { homeId: firstHome.id },
    })
      .then(result => {
        // Use pantry from mutation response (eliminates race condition)
        const returnedPantry =
          result.data?.setDefaultHome?.__typename === 'SetDefaultHomeSuccess'
            ? result.data.setDefaultHome.defaultPantry
            : null;
        if (returnedPantry?.id && !selectedPantryId) {
          setSelectedPantryId(returnedPantry.id);
          console.log(
            '🏠 Set pantry from SetDefaultHome response:',
            returnedPantry.id,
          );
        } else if (!selectedPantryId) {
          const firstHomePantry =
            firstHomePantries.find(p => p.isDefault) ?? firstHomePantries[0];
          if (firstHomePantry?.id) {
            setSelectedPantryId(firstHomePantry.id);
            console.log(
              '🏠 Auto-selected first home pantry (fallback):',
              firstHomePantry.id,
            );
          }
        }
      })
      .catch(err => {
        console.warn('Failed to set first home as default on server:', err);
        if (!selectedPantryId) {
          const firstHomePantry =
            firstHomePantries.find(p => p.isDefault) ?? firstHomePantries[0];
          if (firstHomePantry?.id) {
            setSelectedPantryId(firstHomePantry.id);
            console.log(
              '🏠 Auto-selected first home pantry (error fallback):',
              firstHomePantry.id,
            );
          }
        }
      });

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
    setDefaultHomeMutation,
  ]);

  // FIRST HOME VIA INVITATION: When a user with no homes accepts their first invitation,
  // selectedHomeId is set but no server default exists. Sync the accepted home as default.
  useEffect(() => {
    if (!homesList || homesList.length !== 1) return;
    if (!selectedHomeId || selectedHomeId !== homesList[0].id) return;
    if (remoteDefaultHomeId) return;
    if (loading || !called) return;

    console.log(
      '🏠 First home via invitation, syncing as server default:',
      selectedHomeId,
    );

    setDefaultHomeMutation({
      variables: { homeId: selectedHomeId },
    })
      .then(result => {
        const returnedPantry =
          result.data?.setDefaultHome?.__typename === 'SetDefaultHomeSuccess'
            ? result.data.setDefaultHome.defaultPantry
            : null;
        if (returnedPantry?.id && !selectedPantryId) {
          setSelectedPantryId(returnedPantry.id);
          console.log(
            '🏠 Set pantry from SetDefaultHome response:',
            returnedPantry.id,
          );
        }
      })
      .catch(err => {
        console.warn('Failed to set first invitation home as default:', err);
      });
  }, [
    homesList,
    selectedHomeId,
    selectedPantryId,
    remoteDefaultHomeId,
    loading,
    called,
    setDefaultHomeMutation,
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

    // Case 1: No homes exist - ready with no selection
    if (!homesList || homesList.length === 0) {
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
    isHomeSelectionReady,
    needsClearing,
    setIsHomeSelectionReady,
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

  // Helper function to get the default pantry from a home (connection-shape).
  const getDefaultPantry = (homeData: any) => {
    const home = homeData?.home ?? homeData;
    const pantries = pantriesOf(home);

    if (!pantries.length) {
      return null;
    }
    return pantries.find(p => p.isDefault) ?? pantries[0] ?? null;
  };

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

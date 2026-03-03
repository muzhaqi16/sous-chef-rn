import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useApolloClient } from '@apollo/client/react';
import { useGetHomesLazyQuery, useSetDefaultHomeMutation } from '#generated';
import {
  useAppStore,
  selectPantryState,
  selectIsHomeSelectionReady,
  selectSetIsHomeSelectionReady,
  selectIsLoggingOut,
} from '#store/useAppStore';
import { useStore } from '#store';
import { useAuth } from '#hooks/auth/useAuth';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';
import {
  normalizeHome,
  normalizeHomes,
  extractNodes,
} from '#/utils/connectionUtils';

export const useDefaultHome = () => {
  const client = useApolloClient();
  const {
    selectedHomeId,
    setSelectedHomeId,
    selectedPantryId,
    setSelectedPantryId,
  } = useAppStore(useShallow(selectPantryState));
  const { canAttemptQueries } = useAuth();

  // Track if we're currently clearing stale IDs to prevent race condition
  const [isClearingStaleIds, setIsClearingStaleIds] = useState(false);

  // Track if we've already initialized defaults to prevent cascading re-renders
  const hasInitializedRef = useRef(false);
  // Track if we've already triggered auto-select for first home
  const hasAutoSelectedRef = useRef(false);

  // Track logout state to reset refs when user logs out
  const isLoggingOut = useAppStore(selectIsLoggingOut);
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
  const isHomeSelectionReady = useAppStore(selectIsHomeSelectionReady);
  const setIsHomeSelectionReady = useAppStore(selectSetIsHomeSelectionReady);

  // SetDefaultHome mutation for syncing auto-selection to server
  const [setDefaultHomeMutation] = useSetDefaultHomeMutation({
    errorPolicy: 'all',
  });

  // PERFORMANCE: Use lazy queries with STABLE options to control when they execute
  // Using hardcoded 'cache-first' instead of dynamic policy prevents function recreation
  // on network status changes which caused query cascades
  const [getHomes, { data: homes, loading, error, called }] =
    useGetHomesLazyQuery({
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first',
      errorPolicy: 'ignore',
    });

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
    const { hasInitializedHomeData: hasInitialized, setHasInitializedHomeData } = useStore.getState();
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

  // Preserve homes data even when query fails - prevents cascade failures
  // Extract nodes from connection type (homes returns HomeConnection)
  const homesList = normalizeHomes(
    usePreservedArrayData(extractNodes(homes?.homes)),
  );

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = homesList?.find(h => h.isDefault)?.id ?? null;

  // PERFORMANCE: Extract default pantry ID with stable reference to prevent infinite loops
  // Using useMemo ensures we only recalculate when the underlying data changes
  const defaultPantryId = (() => {
    // Find the default home from the homes list
    const defaultHome = homesList?.find(h => h.isDefault);
    if (!defaultHome?.pantries?.length) return null;
    const defaultPantry =
      defaultHome.pantries.find((p: { isDefault?: boolean; id?: string }) => p.isDefault) ||
      defaultHome.pantries[0];
    return defaultPantry?.id || null;
  })();

  // Validate that selectedHomeId still exists in the homes list
  const isSelectedHomeValid = (() => {
    if (!selectedHomeId || !homesList || homesList.length === 0) return false;
    return homesList.some(h => h.id === selectedHomeId);
  })();

  // Clear stale selectedHomeId if home was deleted while app was in background
  // Also reset ready state to force re-initialization
  useEffect(() => {
    if (
      selectedHomeId &&
      homesList &&
      homesList.length > 0 &&
      !isSelectedHomeValid
    ) {
      console.warn(
        '[HomeSelector] Selected home no longer exists, clearing selection',
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- coordinating with cache eviction side effect
      setIsClearingStaleIds(true);

      // Evict stale Home and Pantry entities from Apollo cache
      // This prevents cache-only queries from returning deleted entities
      const homeIdentifier = client.cache.identify({
        __typename: 'Home',
        id: selectedHomeId,
      });
      if (homeIdentifier) {
        client.cache.evict({ id: homeIdentifier });
      }
      if (selectedPantryId) {
        const pantryIdentifier = client.cache.identify({
          __typename: 'Pantry',
          id: selectedPantryId,
        });
        if (pantryIdentifier) {
          client.cache.evict({ id: pantryIdentifier });
        }
      }
      client.cache.gc();

      setSelectedHomeId(null);
      setSelectedPantryId(null);
      setIsHomeSelectionReady(false);
      hasInitializedRef.current = false;
      hasAutoSelectedRef.current = false;
    }
  }, [
    selectedHomeId,
    selectedPantryId,
    homesList,
    isSelectedHomeValid,
    setSelectedHomeId,
    setSelectedPantryId,
    setIsHomeSelectionReady,
    client,
  ]);

  // Reset clearing flag after state updates propagate
  useEffect(() => {
    if (isClearingStaleIds && !selectedHomeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting flag after cache eviction propagates
      setIsClearingStaleIds(false);
    }
  }, [isClearingStaleIds, selectedHomeId]);

  // Sync remote defaults to local store (one-time initialization)
  // CONSOLIDATED: Both home and pantry are set in a single effect to prevent
  // cascading re-renders that cause duplicate queries
  useEffect(() => {
    // Skip if already initialized
    if (hasInitializedRef.current) return;

    // Wait for remote data to be available
    if (!remoteDefaultHomeId) return;

    let didUpdate = false;

    // Set home if not already selected
    if (!selectedHomeId) {
      setSelectedHomeId(remoteDefaultHomeId);
      didUpdate = true;
      console.log('🏠 Auto-selected default home:', remoteDefaultHomeId);
    }

    // Set pantry if not already selected AND we have the data
    if (!selectedPantryId && defaultPantryId) {
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
    const firstHome = homesList[0];
    console.log(
      '🏠 No default home on server, auto-selecting first home:',
      firstHome.id,
    );

    hasAutoSelectedRef.current = true;
    setSelectedHomeId(firstHome.id);

    // Set pantry immediately from local data (mutation will confirm/update later)
    const localDefaultPantry =
      firstHome.pantries?.find((p: { isDefault?: boolean; id?: string }) => p.isDefault) ||
      firstHome.pantries?.[0];
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
        const returnedPantry = result.data?.setDefaultHome?.defaultPantry;
        if (returnedPantry?.id && !selectedPantryId) {
          setSelectedPantryId(returnedPantry.id);
          console.log(
            '🏠 Set pantry from SetDefaultHome response:',
            returnedPantry.id,
          );
        } else if (!selectedPantryId) {
          // Fallback: Get default pantry from first home data if mutation didn't return one
          const firstHomePantry =
            firstHome.pantries?.find((p: { isDefault?: boolean; id?: string }) => p.isDefault) ||
            firstHome.pantries?.[0];
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
        // Fallback on error: try to set pantry from home data
        if (!selectedPantryId) {
          const firstHomePantry =
            firstHome.pantries?.find((p: { isDefault?: boolean; id?: string }) => p.isDefault) ||
            firstHome.pantries?.[0];
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

  // SET HOME SELECTION READY: Only when initialization is truly complete
  // This gates pantry queries to prevent race conditions
  useEffect(() => {
    // Don't update if query hasn't been called yet
    if (!called) return;

    // Don't update while loading
    if (loading) return;

    // Don't update while clearing stale IDs (wait for state to propagate)
    if (isClearingStaleIds) return;

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
    isClearingStaleIds,
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
      !isClearingStaleIds
    ) {
      hasAutoSelectedRef.current = false;
    }
  }, [isHomeSelectionReady, selectedHomeId, homesList, remoteDefaultHomeId, isClearingStaleIds]);

  // Helper function to get the default pantry from a home
  // Handle both normalized homes (with pantries array) and raw homes (with pantriesConnection)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- homeData shape varies between raw and normalized homes
  const getDefaultPantry = (homeData: any) => {
    const home = homeData?.home ?? homeData;
    const pantries = home?.pantries ?? normalizeHome(home)?.pantries ?? [];

    if (!pantries.length) {
      return null;
    }
    return (
      pantries.find((pantry: { isDefault?: boolean; id?: string }) => pantry.isDefault) || pantries[0] || null
    );
  };

  // Provide the most appropriate home ID (prefer Zustand store, fallback to remote default)
  // This ensures instant UI updates after mutations while still syncing from server on initial load
  const currentHomeId = selectedHomeId ?? remoteDefaultHomeId;

  return {
    selectedHomeId: currentHomeId,
    homes: homesList,
    loading,
    error,
    hasDefaultHome: !!currentHomeId,
    getDefaultPantry,
    remoteDefaultHomeId,
    selectedPantryId,
    setSelectedPantryId,
    isHomeSelectionReady,
  };
};

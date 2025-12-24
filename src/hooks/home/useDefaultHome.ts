import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGetHomesLazyQuery } from '#generated';
import {
  useAppStore,
  selectPantryState,
  selectHasInitializedHomeData,
  selectSetHasInitializedHomeData,
} from '#store/useAppStore';
import { useAuth } from '#hooks/auth/useAuth';
import { usePreservedArrayData } from '#/hooks/apollo';
import { normalizeHome, normalizeHomes } from '#/utils/connectionUtils';

export const useDefaultHome = () => {
  const {selectedHomeId, setSelectedHomeId, selectedPantryId, setSelectedPantryId} =
    useAppStore(useShallow(selectPantryState));
  const { canAttemptQueries } = useAuth();

  // Track if we've already initialized defaults to prevent cascading re-renders
  const hasInitializedRef = useRef(false);

  // PERFORMANCE: Use Zustand to track if data has been fetched
  // This survives component remounts (unlike refs) and prevents duplicate queries
  const hasInitializedHomeData = useAppStore(selectHasInitializedHomeData);
  const setHasInitializedHomeData = useAppStore(selectSetHasInitializedHomeData);

  // PERFORMANCE: Use lazy queries with STABLE options to control when they execute
  // Using hardcoded 'cache-first' instead of dynamic policy prevents function recreation
  // on network status changes which caused query cascades
  const [getHomes, { data: homes, loading, error }] = useGetHomesLazyQuery({
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  // Execute query ONCE when authenticated and no home is selected
  // This prevents the query cascade issue where re-renders trigger new queries
  // Uses Zustand flag (survives remounts) instead of ref, and omits getHomes
  // from deps since it only needs to be called once (not re-called when it changes)
  useEffect(() => {
    if (canAttemptQueries && !hasInitializedHomeData && !selectedHomeId) {
      setHasInitializedHomeData(true);
      getHomes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAttemptQueries, selectedHomeId, hasInitializedHomeData]);

  // Preserve homes data even when query fails - prevents cascade failures
  const homesList = normalizeHomes(usePreservedArrayData(homes?.homes));

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = useMemo(
    () => homesList?.find((h: any) => h.isDefault)?.id ?? null,
    [homesList],
  );

  // PERFORMANCE: Extract default pantry ID with stable reference to prevent infinite loops
  // Using useMemo ensures we only recalculate when the underlying data changes
  const defaultPantryId = useMemo(() => {
    // Find the default home from the homes list
    const defaultHome = homesList?.find((h: any) => h.isDefault);
    if (!defaultHome?.pantries?.length) return null;
    const defaultPantry =
      defaultHome.pantries.find((p: any) => p.isDefault) ||
      defaultHome.pantries[0];
    return defaultPantry?.id || null;
  }, [homesList]);

  // Validate that selectedHomeId still exists in the homes list
  const isSelectedHomeValid = useMemo(() => {
    if (!selectedHomeId || !homesList || homesList.length === 0) return false;
    return homesList.some((h: any) => h.id === selectedHomeId);
  }, [selectedHomeId, homesList]);

  // Clear stale selectedHomeId if home was deleted while app was in background
  useEffect(() => {
    if (selectedHomeId && homesList && homesList.length > 0 && !isSelectedHomeValid) {
      console.warn('[HomeSelector] Selected home no longer exists, clearing selection');
      setSelectedHomeId(null);
    }
  }, [selectedHomeId, homesList, isSelectedHomeValid, setSelectedHomeId]);

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
    if (didUpdate || (selectedHomeId && (selectedPantryId || !defaultPantryId))) {
      hasInitializedRef.current = true;
    }
  }, [remoteDefaultHomeId, defaultPantryId, selectedHomeId, selectedPantryId, setSelectedHomeId, setSelectedPantryId]);

  // Helper function to get the default pantry from a home
  const getDefaultPantry = (homeData: any) => {
    const normalizedHome = normalizeHome(homeData?.home ?? homeData);
    if (!normalizedHome?.pantries?.length) {
      return null;
    }

    return (
      normalizedHome.pantries.find((pantry: any) => pantry.isDefault) ||
      normalizedHome.pantries[0] ||
      null
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
  };
};

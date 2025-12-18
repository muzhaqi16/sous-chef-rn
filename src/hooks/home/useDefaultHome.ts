import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGetHomesQuery, useGetDefaultHomeQuery } from '#generated';
import { useAppStore, selectPantryState } from '#store/useAppStore';
import { useAuth } from '#hooks/auth/useAuth';
import { usePreservedArrayData } from '#/hooks/apollo';
import { normalizeHome, normalizeHomes } from '#/utils/connectionUtils';
import { useOfflinePresetPolicy } from '#/apollo/policies/offlineFetchPolicies';

export const useDefaultHome = () => {
  const {selectedHomeId, setSelectedHomeId, selectedPantryId, setSelectedPantryId} =
    useAppStore(useShallow(selectPantryState));
  const { canAttemptQueries } = useAuth();

  // Track if we've already initialized defaults to prevent cascading re-renders
  const hasInitializedHomeRef = useRef(false);
  const hasInitializedPantryRef = useRef(false);

  // Always fetch homes when authenticated (needed for UI and getDefaultPantry)
  const shouldSkip = !canAttemptQueries;

  // PERFORMANCE: Use cache-first for homes data (rarely changes during session)
  // This prevents duplicate network requests when navigating between screens
  const fetchPolicy = useOfflinePresetPolicy('CRITICAL');

  const {
    data: homes,
    loading,
    error,
  } = useGetHomesQuery({
    fetchPolicy,
    nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
    skip: shouldSkip,
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  // Preserve homes data even when query fails - prevents cascade failures
  const homesList = normalizeHomes(usePreservedArrayData(homes?.homes));

  const { data: defaultHomeData, loading: loadingDefaultHome } =
    useGetDefaultHomeQuery({
      fetchPolicy,
      nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
      skip: !canAttemptQueries,
      errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
    });

  const remoteDefaultHomeId = defaultHomeData?.getDefaultHome?.id;

  // PERFORMANCE: Extract default pantry ID with stable reference to prevent infinite loops
  // Using useMemo ensures we only recalculate when the underlying data changes
  const defaultPantryId = useMemo(() => {
    const normalizedHome = normalizeHome(defaultHomeData?.getDefaultHome);
    if (!normalizedHome?.pantries?.length) return null;
    const defaultPantry =
      normalizedHome.pantries.find((p: any) => p.isDefault) ||
      normalizedHome.pantries[0];
    return defaultPantry?.id || null;
  }, [defaultHomeData?.getDefaultHome]);

  // Sync remote default home to local store (one-time initialization)
  // Uses ref to prevent cascading re-renders when state is set
  useEffect(() => {
    // Skip if already initialized or no remote data
    if (hasInitializedHomeRef.current || !remoteDefaultHomeId) return;

    // Only sync remote → local when no local selection exists
    if (!selectedHomeId) {
      hasInitializedHomeRef.current = true;
      setSelectedHomeId(remoteDefaultHomeId);
      console.log('🏠 Auto-selected default home:', remoteDefaultHomeId);
    } else {
      // Already have a selection, mark as initialized
      hasInitializedHomeRef.current = true;
    }
  }, [remoteDefaultHomeId, selectedHomeId, setSelectedHomeId]);

  // Sync remote default pantry to local store (one-time initialization)
  // Separate effect to avoid coupling home and pantry initialization
  useEffect(() => {
    // Skip if already initialized or missing required data
    if (hasInitializedPantryRef.current || !remoteDefaultHomeId || !defaultPantryId) return;

    // Only sync remote → local when no local selection exists
    if (!selectedPantryId) {
      hasInitializedPantryRef.current = true;
      setSelectedPantryId(defaultPantryId);
      console.log('🏠 Auto-selected default pantry:', defaultPantryId);
    } else {
      // Already have a selection, mark as initialized
      hasInitializedPantryRef.current = true;
    }
  }, [remoteDefaultHomeId, defaultPantryId, selectedPantryId, setSelectedPantryId]);

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
    loading: loading || loadingDefaultHome,
    error,
    hasDefaultHome: !!currentHomeId,
    getDefaultPantry,
    remoteDefaultHomeId,
    selectedPantryId,
    setSelectedPantryId,
  };
};

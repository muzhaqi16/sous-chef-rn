import { useEffect } from 'react';
import { useGetHomesQuery, useGetDefaultHomeQuery } from '#generated';
import { useStore } from '#store';
import { useAuth } from '#hooks/auth/useAuth';
import { usePreservedArrayData } from '#/hooks/apollo';
import { normalizeHome, normalizeHomes } from '#/utils/connectionUtils';

export const useDefaultHome = () => {
  const { selectedHomeId, setSelectedHomeId, selectedPantryId, setSelectedPantryId } = useStore();
  const { canAttemptQueries } = useAuth();

  // Always fetch homes when authenticated (needed for UI and getDefaultPantry)
  const shouldSkip = !canAttemptQueries;

  const {
    data: homes,
    loading,
    error,
  } = useGetHomesQuery({
    fetchPolicy: 'cache-and-network', // Ensure fresh data after token refresh
    nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
    skip: shouldSkip,
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  // Preserve homes data even when query fails - prevents cascade failures
  const homesList = normalizeHomes(usePreservedArrayData(homes?.homes));

  const { data: defaultHomeData, loading: loadingDefaultHome } =
    useGetDefaultHomeQuery({
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
      skip: !canAttemptQueries,
      errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
    });

  const remoteDefaultHomeId = defaultHomeData?.getDefaultHome?.id;

  // Sync remote default home and pantry to local store
  // This ensures backend's defaults are auto-selected on new device login
  useEffect(() => {
    // Only sync remote → local when no local selection exists
    // This prevents interference with user-initiated setDefaultHome actions
    if (!selectedHomeId && remoteDefaultHomeId) {
      setSelectedHomeId(remoteDefaultHomeId);
      console.log('🏠 Auto-selected default home:', remoteDefaultHomeId);
    }

    // Auto-select default pantry when home data loads (for returning users on new devices)
    // This ensures users see their pantry immediately after login, matching onboarding behavior
    if (remoteDefaultHomeId && !selectedPantryId) {
      const defaultPantry = getDefaultPantry(defaultHomeData);
      if (defaultPantry?.id) {
        setSelectedPantryId(defaultPantry.id);
        console.log('🏠 Auto-selected default pantry:', defaultPantry.id);
      }
    }
  }, [
    remoteDefaultHomeId,
    selectedHomeId,
    setSelectedHomeId,
    selectedPantryId,
    defaultHomeData,
    setSelectedPantryId,
  ]);

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

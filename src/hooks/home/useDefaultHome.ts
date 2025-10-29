import { useEffect } from 'react';
import { useGetHomesQuery, useGetDefaultHomeQuery } from '#generated';
import { useStore } from '#store';
import { useAuth } from '#hooks/auth/useAuth';
import { usePreservedArrayData } from '#/hooks/apollo';

export const useDefaultHome = () => {
  const { selectedHomeId, setSelectedHomeId } = useStore();
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
  const homesList = usePreservedArrayData(homes?.homes);

  const { data: defaultHomeData, loading: loadingDefaultHome } =
    useGetDefaultHomeQuery({
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first', // Subsequent fetches use cache to avoid unnecessary refetches
      skip: !canAttemptQueries,
      errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
    });

  const remoteDefaultHomeId = defaultHomeData?.getDefaultHome?.id;

  // Sync remote default home to local store when available and different
  // This ensures backend's default home is auto-selected on new device login
  useEffect(() => {
    if (remoteDefaultHomeId && remoteDefaultHomeId !== selectedHomeId) {
      setSelectedHomeId(remoteDefaultHomeId);
    }
  }, [remoteDefaultHomeId, selectedHomeId, setSelectedHomeId]);

  // Helper function to get the default pantry from a home
  const getDefaultPantry = (homeData: any) => {
    if (!homeData?.home?.pantries) return null;

    // First try to find a pantry marked as default
    const defaultPantry = homeData.home.pantries.find(
      (pantry: any) => pantry.isDefault,
    );
    if (defaultPantry) {
      return defaultPantry;
    }

    // If no default pantry, return the first one
    return homeData.home.pantries.length > 0 ? homeData.home.pantries[0] : null;
  };

  // Provide the most appropriate home ID (prefer remote default, fallback to store value)
  const currentHomeId = remoteDefaultHomeId || selectedHomeId;

  return {
    selectedHomeId: currentHomeId,
    homes: homesList,
    loading: loading || loadingDefaultHome,
    error,
    hasDefaultHome: !!currentHomeId,
    getDefaultPantry,
    remoteDefaultHomeId,
  };
};

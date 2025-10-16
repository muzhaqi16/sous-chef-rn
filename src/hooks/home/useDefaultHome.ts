import { useEffect } from 'react';
import { useGetHomesQuery, useGetDefaultHomeQuery } from '#generated';
import { useStore } from '#store';
import { useAuth } from '#hooks/auth/useAuth';

export const useDefaultHome = () => {
  const { selectedHomeId, setSelectedHomeId } = useStore();
  const { canAttemptQueries } = useAuth();

  // Always fetch homes when authenticated (needed for UI and getDefaultPantry)
  const shouldSkip = !canAttemptQueries;

  const {
    data: homes,
    loading,
    error,
    refetch,
  } = useGetHomesQuery({
    fetchPolicy: 'cache-and-network', // Ensure fresh data after token refresh
    skip: shouldSkip,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all', // Allow partial data and cache on errors
  });

  const { data: defaultHomeData, loading: loadingDefaultHome } =
    useGetDefaultHomeQuery({
      fetchPolicy: 'cache-and-network',
      skip: !canAttemptQueries,
      notifyOnNetworkStatusChange: true,
      errorPolicy: 'all',
    });

  const remoteDefaultHomeId = defaultHomeData?.getDefaultHome?.id;

  // Retry mechanism: retry when we can attempt queries but no homes data
  // Note: Auth errors (token expiry) are automatically retried by errorLink after token refresh
  // This handles other types of errors (network issues, etc.)
  useEffect(() => {
    if (canAttemptQueries && !homes?.homes && !loading && error) {
      console.log('🔄 Retrying homes query after non-auth error...');
      refetch();
    }
  }, [canAttemptQueries, homes?.homes, loading, error, refetch]);

  // Sync remote default home to local store when available and different
  // This ensures backend's default home is auto-selected on new device login
  useEffect(() => {
    if (remoteDefaultHomeId && remoteDefaultHomeId !== selectedHomeId) {
      console.log('🏠 Syncing remote default home to local store:', remoteDefaultHomeId);
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
    homes: homes?.homes || [],
    loading: loading || loadingDefaultHome,
    error,
    hasDefaultHome: !!currentHomeId,
    getDefaultPantry,
    remoteDefaultHomeId,
  };
};

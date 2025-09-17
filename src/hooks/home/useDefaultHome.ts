import { useEffect } from 'react';
import { useGetHomesQuery } from '#generated';
import { useStore } from '#store';
import { useAuth } from '#hooks/auth/useAuth';

export const useDefaultHome = () => {
  const { selectedHomeId, setSelectedHomeId } = useStore();
  const { user, accessToken, canAttemptQueries } = useAuth();

  // Don't skip if we can attempt queries (has tokens and not logging out)
  const shouldSkip = !!selectedHomeId || !canAttemptQueries;

  const {
    data: homes,
    loading,
    error,
    refetch,
  } = useGetHomesQuery({
    fetchPolicy: 'cache-first',
    skip: shouldSkip,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all', // Allow partial data and cache on errors
  });


  // Retry mechanism: retry when we can attempt queries but no homes data
  useEffect(() => {
    if (canAttemptQueries && !homes?.homes && !loading && error) {
      refetch();
    }
  }, [canAttemptQueries, homes?.homes, loading, error, refetch]);

  // Additional retry when user becomes available after token refresh
  useEffect(() => {
    if (user && accessToken && !homes?.homes && !loading) {
      refetch();
    }
  }, [user, accessToken, homes?.homes, loading, refetch]);

  useEffect(() => {
    // Only proceed if we don't have a selected home and homes data is available
    if (!selectedHomeId && homes?.homes && homes.homes.length > 0) {
      // Select the first home as default
      const defaultHome = homes.homes[0];

      setSelectedHomeId(defaultHome.id);
    }
  }, [selectedHomeId, homes, setSelectedHomeId]);

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

  return {
    selectedHomeId,
    homes: homes?.homes || [],
    loading,
    error,
    hasDefaultHome: !!selectedHomeId,
    getDefaultPantry,
  };
};

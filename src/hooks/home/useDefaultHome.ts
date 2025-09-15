import {useEffect} from 'react';
import {useGetHomesQuery} from '#generated';
import {useStore} from '#store';

export const useDefaultHome = () => {
  const {selectedHomeId, setSelectedHomeId, user, isLoggingOut} = useStore();

  const {
    data: homes,
    loading,
    error,
  } = useGetHomesQuery({
    fetchPolicy: 'cache-and-network',
    skip: !!selectedHomeId || !user || isLoggingOut, // Skip if we have a selected home, no user, or logging out
  });

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

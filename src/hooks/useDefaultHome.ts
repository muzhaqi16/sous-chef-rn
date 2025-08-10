import {useEffect} from 'react';
import {useHomesQuery} from '#generated';
import {useStore} from '#store';

export const useDefaultHome = () => {
  const {selectedHomeId, setSelectedHomeId} = useStore();

  const {
    data: homes,
    loading,
    error,
  } = useHomesQuery({
    fetchPolicy: 'cache-and-network',
    skip: !!selectedHomeId, // Skip if we already have a selected home
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
  const getDefaultPantryId = (homeData: any) => {
    if (!homeData?.home?.pantries) return null;

    // First try to find a pantry marked as default
    const defaultPantry = homeData.home.pantries.find(
      (pantry: any) => pantry.isDefault,
    );
    if (defaultPantry) {
      return defaultPantry.id;
    }

    // If no default pantry, return the first one
    return homeData.home.pantries.length > 0
      ? homeData.home.pantries[0].id
      : null;
  };

  return {
    selectedHomeId,
    homes: homes?.homes || [],
    loading,
    error,
    hasDefaultHome: !!selectedHomeId,
    getDefaultPantryId,
  };
};

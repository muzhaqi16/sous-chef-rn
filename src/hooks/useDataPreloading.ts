import { useEffect } from 'react';
import { useGetUnitsQuery } from '#generated';
import { useStore } from '#store';
import { useAuth } from './auth/useAuth';

/**
 * Preloads essential reference data for offline access
 *
 * This hook runs silently in the background after authentication to ensure
 * reference data (units, etc.) is available in the cache for offline use.
 *
 * Benefits:
 * - Eliminates loading states when adding shopping list items
 * - Ensures offline functionality for shopping lists
 * - Minimal impact on app startup (runs after hydration)
 */
export function useDataPreloading() {
  const { isAuthenticated } = useAuth();
  const { cachedUnits, setCachedUnits } = useStore();

  // Preload units data when authenticated
  // Uses cache-and-network to show cached data immediately while fetching fresh data
  const { data, loading, error } = useGetUnitsQuery({
    skip: !isAuthenticated,
    fetchPolicy: 'cache-and-network', // Show cache, then update from network
    errorPolicy: 'ignore', // Don't fail on network errors, use cached data
  });

  // Store units in Zustand for fast access (avoids Apollo cache reads)
  useEffect(() => {
    if (data?.units && data.units.length > 0) {
      // Only update if we have new data or cache is empty
      if (cachedUnits.length === 0 || cachedUnits.length !== data.units.length) {
        setCachedUnits(data.units);
      }
    }
  }, [data?.units, cachedUnits.length, setCachedUnits]);

  return {
    isPreloading: loading,
    preloadError: error,
    unitsLoaded: cachedUnits.length > 0,
  };
}

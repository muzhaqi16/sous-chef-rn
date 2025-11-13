import { useEffect } from 'react';
import { useGetCommonUnitsQuery } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { useAuth } from './auth/useAuth';

/**
 * Preloads essential reference data for offline access
 *
 * This hook runs silently in the background after authentication to ensure
 * reference data (common units, etc.) is available in the cache for offline use.
 *
 * Benefits:
 * - Eliminates loading states when adding shopping list items
 * - Ensures offline functionality for shopping lists
 * - Minimal impact on app startup (loads only ~10-50 common units instead of 1000+)
 * - For full unit search, use SearchUnits query in autocomplete components
 */
export function useDataPreloading() {
  const { isAuthenticated } = useAuth();
  const cachedUnits = useAppStore(state => state.cachedUnits);
  const setCachedUnits = useAppStore(state => state.setCachedUnits);

  // Preload common units data when authenticated
  // Uses cache-and-network to show cached data immediately while fetching fresh data
  // Only loads frequently-used units (~10-50) instead of all 1000+ units
  const { data, loading, error } = useGetCommonUnitsQuery({
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

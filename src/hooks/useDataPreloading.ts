import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGetCommonUnitsQuery } from '#generated';
import { useAppStore, selectAuthState } from '#store/useAppStore';

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
  // Access auth state directly from store to avoid circular dependency with useAuth
  const {user, accessToken} = useAppStore(useShallow(selectAuthState));
  const isAuthenticated = !!(user && accessToken);

  const cachedUnits = useAppStore(state => state.cachedUnits);
  const setCachedUnits = useAppStore(state => state.setCachedUnits);

  // PERFORMANCE: Track if units have been cached to prevent infinite loop
  const hasCachedUnitsRef = useRef(false);

  // Preload common units data when authenticated
  // Uses cache-and-network to show cached data immediately while fetching fresh data
  // Only loads frequently-used units (~10-50) instead of all 1000+ units
  const { data, loading, error } = useGetCommonUnitsQuery({
    skip: !isAuthenticated,
    fetchPolicy: 'cache-and-network', // Show cache, then update from network
    errorPolicy: 'ignore', // Don't fail on network errors, use cached data
  });

  // Store units in Zustand for fast access (avoids Apollo cache reads)
  // PERFORMANCE: Use ref to prevent feedback loop (cachedUnits.length triggering re-render)
  useEffect(() => {
    if (data?.units && data.units.length > 0 && !hasCachedUnitsRef.current) {
      setCachedUnits(data.units);
      hasCachedUnitsRef.current = true;
    }
  }, [data?.units, setCachedUnits]);

  return {
    isPreloading: loading,
    preloadError: error,
    unitsLoaded: cachedUnits.length > 0,
  };
}

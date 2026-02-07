import { useEffect, useRef, useCallback, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useDeferredCallback } from './performance/useDeferredCallback';
import {
  useGetCommonUnitsLazyQuery,
  useGetShoppingListsLiteLazyQuery,
  useMySavedRecipesLazyQuery,
} from '#generated';
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
 *
 * Background preloading:
 * - After login completes, waits for UI interactions to settle
 * - Then preloads shopping lists and saved recipes in staggered order
 * - Non-blocking: doesn't interfere with current screen's essential data
 */
export function useDataPreloading() {
  // Access auth state directly from store to avoid circular dependency with useAuth
  const { user, accessToken } = useAppStore(useShallow(selectAuthState));
  const isAuthenticated = !!(user && accessToken);

  const cachedUnits = useAppStore(state => state.cachedUnits);
  const setCachedUnits = useAppStore(state => state.setCachedUnits);
  const isOnline = useAppStore(state => state.isOnline);

  // PERFORMANCE: Track if units have been cached to prevent infinite loop
  const hasCachedUnitsRef = useRef(false);
  // Track if background preload has run this session
  const hasPreloadedRef = useRef(false);
  // Track if units query has been fetched this session
  const hasUnitsQueryFetchedRef = useRef(false);
  // Track loading state for deferred units query
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<Error | undefined>(undefined);

  // PERFORMANCE: Use lazy query for common units to defer execution
  // Units are only needed when user opens add item sheet - not at startup
  const [fetchCommonUnits, { data }] = useGetCommonUnitsLazyQuery({
    fetchPolicy: 'cache-and-network', // Show cache, then update from network
    errorPolicy: 'ignore', // Don't fail on network errors, use cached data
  });

  // Lazy queries for background preloading (non-blocking)
  const [fetchShoppingLists] = useGetShoppingListsLiteLazyQuery({
    fetchPolicy: 'network-only',
    errorPolicy: 'ignore',
  });

  const [fetchSavedRecipes] = useMySavedRecipesLazyQuery({
    fetchPolicy: 'network-only',
    errorPolicy: 'ignore',
  });

  // Fetch common units with deferred execution
  const fetchUnits = useCallback(async () => {
    if (hasUnitsQueryFetchedRef.current || !isOnline) return;
    hasUnitsQueryFetchedRef.current = true;

    if (__DEV__) {
      console.log('📦 [useDataPreloading] Deferred common units query started');
    }

    setUnitsLoading(true);
    try {
      await fetchCommonUnits();
    } catch (err) {
      setUnitsError(err instanceof Error ? err : new Error('Failed to fetch units'));
    } finally {
      setUnitsLoading(false);
    }
  }, [isOnline, fetchCommonUnits]);

  // PERFORMANCE: Defer common units query by 6000ms to avoid competing with
  // screen-critical queries (GetHomes, GetPantry) at startup.
  // Units are only needed when user opens add item sheet.
  useDeferredCallback(fetchUnits, isAuthenticated && isOnline, 6000);

  // Background preload function - staggers queries to avoid JS thread contention
  const runBackgroundPreload = useCallback(() => {
    if (!isOnline) return;

    // Stagger queries 500ms apart so each gets its own JS thread window
    fetchShoppingLists();

    setTimeout(() => {
      fetchSavedRecipes();
    }, 500);
  }, [isOnline, fetchShoppingLists, fetchSavedRecipes]);

  // Store units in Zustand for fast access (avoids Apollo cache reads)
  // PERFORMANCE: Use ref to prevent feedback loop (cachedUnits.length triggering re-render)
  useEffect(() => {
    if (data?.units && data.units.length > 0 && !hasCachedUnitsRef.current) {
      setCachedUnits(data.units);
      hasCachedUnitsRef.current = true;
    }
  }, [data?.units, setCachedUnits]);

  // Trigger background preload when runtime is idle (non-blocking)
  // PERFORMANCE: 5000ms timeout ensures GetHomes + GetPantry complete first
  useDeferredCallback(() => {
    if (hasPreloadedRef.current) return;
    hasPreloadedRef.current = true;
    runBackgroundPreload();
  }, isAuthenticated && isOnline, 5000);

  // Reset preload flags on logout so queries run again on next login
  useEffect(() => {
    if (!isAuthenticated) {
      hasPreloadedRef.current = false;
      hasUnitsQueryFetchedRef.current = false;
      hasCachedUnitsRef.current = false;
    }
  }, [isAuthenticated]);

  return {
    isPreloading: unitsLoading,
    preloadError: unitsError,
    unitsLoaded: cachedUnits.length > 0,
  };
}

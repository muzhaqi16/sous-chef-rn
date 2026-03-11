import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGetCommonUnitsLazyQuery } from '#generated';
import {
  useAppStore,
  selectAuthState,
  selectIsPantryQueryComplete,
} from '#store/useAppStore';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

/** 24 hours in milliseconds — matches backend refresh cadence for common units */
const UNITS_CACHE_TTL = 24 * 60 * 60 * 1000;

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
 * Event-driven preloading:
 * - Waits for `isPantryQueryComplete` — fires only after GetPantry settles
 * - No artificial delays — the semantic gate provides correct ordering
 *
 * TTL-based freshness:
 * - Skips network fetch if persisted units exist and were fetched within 24h
 * - Reduces redundant network traffic on every app start
 */
export function useDataPreloading() {
  // Access auth state directly from store to avoid circular dependency with useAuth
  const { user, accessToken } = useAppStore(useShallow(selectAuthState));
  const isAuthenticated = !!(user && accessToken);

  const cachedUnits = useAppStore(state => state.cachedUnits);
  const setCachedUnits = useAppStore(state => state.setCachedUnits);
  const lastUnitsFetchedAt = useAppStore(state => state.lastUnitsFetchedAt);
  const setLastUnitsFetchedAt = useAppStore(
    state => state.setLastUnitsFetchedAt,
  );
  const isOnline = useAppStore(state => state.isOnline);
  const isPantryQueryComplete = useAppStore(selectIsPantryQueryComplete);

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
    fetchPolicy: 'cache-first', // Freshness controlled by TTL, not Apollo
    errorPolicy: 'ignore', // Don't fail on network errors, use cached data
  });

  // Trigger preloading once GetPantry has settled (semantic gate, no timing hacks)
  useEffect(() => {
    if (!isAuthenticated || !isOnline || !isPantryQueryComplete) return;
    if (hasPreloadedRef.current) return;
    hasPreloadedRef.current = true;
    hasUnitsQueryFetchedRef.current = true;

    // Skip fetch if persisted units are still fresh
    const isCacheFresh =
      cachedUnits.length > 0 &&
      lastUnitsFetchedAt !== null &&
      Date.now() - lastUnitsFetchedAt < UNITS_CACHE_TTL;

    if (isCacheFresh) {
      if (__DEV__) {
        console.log(
          '📦 [useDataPreloading] Units cache still fresh — skipping fetch',
        );
      }
      return;
    }

    if (__DEV__) {
      console.log(
        '📦 [useDataPreloading] GetPantry settled — fetching GetCommonUnits',
      );
    }

    executeWithLoadingState(
      async () => {
        await fetchCommonUnits();
        setLastUnitsFetchedAt(Date.now());
      },
      setUnitsLoading,
      (err) => {
        setUnitsError(
          err instanceof Error ? err : new Error('Failed to fetch units'),
        );
      },
    );
  }, [
    isAuthenticated,
    isOnline,
    isPantryQueryComplete,
    fetchCommonUnits,
    cachedUnits.length,
    lastUnitsFetchedAt,
    setLastUnitsFetchedAt,
  ]);

  // Store units in Zustand for fast access (avoids Apollo cache reads)
  // PERFORMANCE: Use ref to prevent feedback loop (cachedUnits.length triggering re-render)
  useEffect(() => {
    if (data?.units && data.units.length > 0 && !hasCachedUnitsRef.current) {
      setCachedUnits(data.units);
      hasCachedUnitsRef.current = true;
    }
  }, [data?.units, setCachedUnits]);

  // Reset preload flags on logout so queries run again on next login
  useEffect(() => {
    if (!isAuthenticated) {
      hasPreloadedRef.current = false;
      hasUnitsQueryFetchedRef.current = false;
      hasCachedUnitsRef.current = false;
      setLastUnitsFetchedAt(0);
    }
  }, [isAuthenticated, setLastUnitsFetchedAt]);

  return {
    isPreloading: unitsLoading,
    preloadError: unitsError,
    unitsLoaded: cachedUnits.length > 0,
  };
}

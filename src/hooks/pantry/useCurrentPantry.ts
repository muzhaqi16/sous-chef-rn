import { useMemo, useEffect, useCallback } from 'react';
import { useAppStore, selectPantryState, selectSelectedHomeId } from '#store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useGetHomesQuery } from '#generated';
import { normalizeHomes, normalizeHome } from '#/utils/connectionUtils';
import { usePreservedArrayData } from '#/hooks/apollo';

/**
 * Hook for resolving the current pantry with fallback chain:
 * 1. Selected pantry (from Zustand - what user is currently viewing)
 * 2. Home's default pantry (isDefault=true set by owner)
 * 3. First pantry (if no default marked)
 * 4. Minimal object (during loading/network errors)
 *
 * PERFORMANCE: This hook uses cache-only fetch policy to read from Apollo cache
 * WITHOUT triggering network requests. This prevents cross-screen query cascade.
 * Home data is fetched by PantryMain (the primary screen) which populates the cache.
 */
export function useCurrentPantry() {
  const selectedHomeId = useAppStore(selectSelectedHomeId);
  const { selectedPantryId, setSelectedPantryId } = useAppStore(
    useShallow(selectPantryState),
  );

  // Read homes from Apollo cache using cache-only policy
  // This subscribes to cache updates but NEVER makes network requests
  // Prevents cascade: no network = no refetch on tab switch
  const { data: homesData } = useGetHomesQuery({
    fetchPolicy: 'cache-only',
    errorPolicy: 'ignore',
  });

  // Preserve homes data and normalize
  const homes = normalizeHomes(usePreservedArrayData(homesData?.homes));

  // Get current home from cached homes
  const currentHome = useMemo(
    () => homes.find((h: any) => h.id === selectedHomeId),
    [homes, selectedHomeId],
  );

  // Helper to get default pantry from a home
  const getDefaultPantry = useCallback((homeData: any) => {
    const normalizedHome = normalizeHome(homeData?.home ?? homeData);
    if (!normalizedHome?.pantries?.length) {
      return null;
    }
    return (
      normalizedHome.pantries.find((pantry: any) => pantry.isDefault) ||
      normalizedHome.pantries[0] ||
      null
    );
  }, []);

  // Get home's default pantry (isDefault=true or first)
  const defaultPantry = useMemo(
    () => getDefaultPantry({ home: currentHome }),
    [currentHome, getDefaultPantry],
  );

  // Resolve pantry with fallback chain
  const pantry = useMemo(() => {
    // 1. Try selected pantry
    if (selectedPantryId && currentHome?.pantries) {
      const found = currentHome.pantries.find(
        (p: any) => p.id === selectedPantryId,
      );
      if (found) return found;
    }

    // 2. Fall back to home's default
    if (defaultPantry) return defaultPantry;

    // 3. Minimal object for loading state
    if (selectedPantryId) {
      return { id: selectedPantryId, name: 'Pantry', isDefault: false };
    }

    return null;
  }, [selectedPantryId, currentHome, defaultPantry]);

  // Auto-select default if none selected
  useEffect(() => {
    if (!selectedPantryId && defaultPantry?.id) {
      setSelectedPantryId(defaultPantry.id);
    }
  }, [selectedPantryId, defaultPantry?.id, setSelectedPantryId]);

  return {
    pantry,
    pantries: currentHome?.pantries || [],
    selectedPantryId,
    setSelectedPantryId,
    currentHome,
    selectedHomeId,
  };
}

import { useEffect } from 'react';
import { useAppStore, selectPantryState, selectSelectedHomeId, selectIsHomeSelectionReady } from '#store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useGetHomesQuery } from '#generated';
import { normalizeHomes, normalizeHome, extractNodes } from '#/utils/connectionUtils';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';

/**
 * Hook for resolving the current pantry with fallback chain:
 * 1. Selected pantry (from Zustand - what user is currently viewing)
 * 2. Home's default pantry (isDefault=true set by owner)
 * 3. First pantry (if no default marked)
 * 4. Minimal object (during loading/network errors)
 *
 * PERFORMANCE: Uses cache-only — useDefaultHome already fetches fresh data with
 * network-only and populates the cache. This hook reads from cache to avoid a
 * duplicate GetHomes network request during startup.
 */
export function useCurrentPantry() {
  const selectedHomeId = useAppStore(selectSelectedHomeId);
  const { selectedPantryId, setSelectedPantryId } = useAppStore(
    useShallow(selectPantryState),
  );
  const isHomeSelectionReady = useAppStore(selectIsHomeSelectionReady);

  const { data: homesData } = useGetHomesQuery({
    fetchPolicy: 'cache-only',
    errorPolicy: 'ignore' });

  // Preserve homes data and normalize
  // Extract nodes from connection type (homes returns HomeConnection)
  const homes = normalizeHomes(usePreservedArrayData(extractNodes(homesData?.homes)));

  // Get current home from cached homes
  const currentHome = (isHomeSelectionReady ? homes.find((h: any) => h.id === selectedHomeId) : undefined);

  // Helper to get default pantry from a home
  // Handle both normalized homes (with pantries array) and raw homes (with pantriesConnection)
  const getDefaultPantry = (homeData: any) => {
    const home = homeData?.home ?? homeData;
    const pantries = home?.pantries ?? normalizeHome(home)?.pantries ?? [];

    if (!pantries.length) {
      return null;
    }
    return (
      pantries.find((pantry: any) => pantry.isDefault) ||
      pantries[0] ||
      null
    );
  };

  // Get home's default pantry (isDefault=true or first)
  const defaultPantry = (isHomeSelectionReady ? getDefaultPantry({ home: currentHome }) : null);

  // Resolve pantry with fallback chain
  const pantry = (() => {
    // Return null if home selection not ready
    if (!isHomeSelectionReady) return null;

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
  })();

  // Auto-select default if none selected (only when ready)
  useEffect(() => {
    if (isHomeSelectionReady && !selectedPantryId && defaultPantry?.id) {
      setSelectedPantryId(defaultPantry.id);
    }
  }, [isHomeSelectionReady, selectedPantryId, defaultPantry?.id, setSelectedPantryId]);

  // Return early values if not ready, otherwise return resolved values
  if (!isHomeSelectionReady) {
    return {
      pantry: null,
      pantries: [],
      selectedPantryId: null,
      setSelectedPantryId,
      currentHome: null,
      selectedHomeId: null,
      homeCount: homes.length,
      isReady: false };
  }

  return {
    pantry,
    pantries: currentHome?.pantries || [],
    selectedPantryId,
    setSelectedPantryId,
    currentHome,
    selectedHomeId,
    homeCount: homes.length,
    isReady: true };
}

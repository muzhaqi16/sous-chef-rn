import { useEffect } from 'react';
import { usePantryState } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';

type PantryNode = { id: string; name?: string; isDefault?: boolean };

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
  const { selectedPantryId, setSelectedPantryId } = usePantryState();
  const { currentHome, homeCount, selectedHomeId, isHomeSelectionReady } =
    useCurrentHome();

  const pantries = extractNodes(
    currentHome?.pantriesConnection as never,
  ) as PantryNode[];

  const defaultPantry = isHomeSelectionReady
    ? pantries.find(p => p.isDefault) ?? pantries[0] ?? null
    : null;

  // Resolve pantry with fallback chain
  const pantry = (() => {
    if (!isHomeSelectionReady) return null;

    // 1. Try selected pantry
    if (selectedPantryId && pantries.length) {
      const found = pantries.find(p => p.id === selectedPantryId);
      if (found) return found;
    }

    // 2. Fall back to home's default
    if (defaultPantry) return defaultPantry;

    // 3. Minimal object — only while currentHome hasn't loaded yet.
    if (selectedPantryId && !currentHome) {
      return { id: selectedPantryId, name: 'Pantry', isDefault: false };
    }

    return null;
  })();

  // Keep selectedPantryId valid for the current home (stale → default in one render).
  useEffect(() => {
    if (!isHomeSelectionReady || !currentHome) return;
    const isValid =
      selectedPantryId && pantries.some(p => p.id === selectedPantryId);
    if (isValid) return;
    const next = defaultPantry?.id ?? null;
    if (next !== selectedPantryId) {
      setSelectedPantryId(next);
    }
  }, [
    isHomeSelectionReady,
    selectedPantryId,
    currentHome,
    pantries,
    defaultPantry?.id,
    setSelectedPantryId,
  ]);

  if (!isHomeSelectionReady) {
    return {
      pantry: null,
      pantries: [],
      selectedPantryId: null,
      setSelectedPantryId,
      currentHome: null,
      selectedHomeId: null,
      homeCount,
      isReady: false,
    };
  }

  return {
    pantry,
    pantries,
    selectedPantryId,
    setSelectedPantryId,
    currentHome,
    selectedHomeId,
    homeCount,
    isReady: true,
  };
}

import { useEffect } from 'react';
import { usePantryState } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';

type PantryNode = { id: string; name?: string; isDefault?: boolean };

/**
 * Resolution order: the selected pantry, the home's default, the first, then a
 * minimal object. Reads cache-only — `useDefaultHome` owns the network fetch, so
 * querying here duplicates a GetHomes request during startup.
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

  // Post-gate reconciler, gated on `isHomeSelectionReady`. The pre-gate repair
  // in `useDefaultHome` is what closes the gate before a bad id is queried;
  // this one fixes the selection once queries are already allowed. Not a
  // duplicate of it.
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

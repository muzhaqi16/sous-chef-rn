import { useMemo, useEffect } from 'react';
import { useAppStore, selectPantryState } from '#store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useDefaultHome } from '#hooks';

/**
 * Hook for resolving the current pantry with fallback chain:
 * 1. Selected pantry (from Zustand - what user is currently viewing)
 * 2. Home's default pantry (isDefault=true set by owner)
 * 3. First pantry (if no default marked)
 * 4. Minimal object (during loading/network errors)
 */
export function useCurrentPantry() {
  const { selectedPantryId, setSelectedPantryId } = useAppStore(
    useShallow(selectPantryState),
  );
  const { homes, selectedHomeId, getDefaultPantry } = useDefaultHome();

  // Get current home (already normalized by useDefaultHome)
  const currentHome = useMemo(
    () => homes.find((h: any) => h.id === selectedHomeId),
    [homes, selectedHomeId],
  );

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

import { useEffect } from 'react';
import {
  useSelectedHomeId,
  usePantryState,
  useIsHomeSelectionReady,
} from '#store/useAppStore';
import { useQuery } from '@apollo/client/react';
import { GetHomesDocument } from '#operations/home/home.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';

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
  const selectedHomeId = useSelectedHomeId();
  const { selectedPantryId, setSelectedPantryId } = usePantryState();
  const isHomeSelectionReady = useIsHomeSelectionReady();

  const { data: homesData } = useQuery(GetHomesDocument, {
    fetchPolicy: 'cache-only',
    errorPolicy: 'ignore',
  });

  // Preserve homes (connection-shape nodes).
  const homes = usePreservedNodes(homesData?.homes);

  type HomeNode = (typeof homes)[number] & {
    name?: string;
    pantriesConnection?: unknown;
    myMembership?: unknown;
  };

  const currentHome = isHomeSelectionReady
    ? (homes.find(h => h.id === selectedHomeId) as HomeNode | undefined)
    : undefined;

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
      homeCount: homes.length,
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
    homeCount: homes.length,
    isReady: true,
  };
}

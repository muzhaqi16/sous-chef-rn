import { useCallback, useMemo } from 'react';
import { useGetHomesLazyQuery } from '#generated';
import { useAppStore, selectSelectedHomeId, selectSelectedPantryId } from '#store/useAppStore';
import { normalizeHome, normalizeHomes, extractNodes } from '#/utils/connectionUtils';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';
import type { BasicPantryFragment } from '#generated';

/**
 * useLazyHomeData - Lazy-loads home data only when explicitly requested
 *
 * Used in ShoppingListMain for "Move to Pantry" feature.
 * Prevents unnecessary home queries during shopping list refresh.
 *
 * Benefits:
 * - Eliminates query cascade on shopping list refresh
 * - Fetches home data only when needed (on-demand)
 * - Uses cache-first to avoid redundant fetches
 */
export function useLazyHomeData() {
  const selectedHomeId = useAppStore(selectSelectedHomeId);
  const selectedPantryId = useAppStore(selectSelectedPantryId);

  const [getHomes, { data: homesData, loading }] = useGetHomesLazyQuery({
    fetchPolicy: 'cache-first', // Use cache if available
    errorPolicy: 'ignore',
  });

  // Normalize homes data (extract nodes from connection type)
  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const rawHomes = useMemo(() => {
    return normalizeHomes(extractNodes(homesData?.homes));
  }, [homesData?.homes]);
  const homes = usePreservedArrayData(rawHomes);

  // Get pantries for the current home
  const pantries = useMemo((): BasicPantryFragment[] => {
    if (!selectedHomeId || !homes.length) return [];
    const currentHome = homes.find(h => h.id === selectedHomeId);
    if (!currentHome) return [];
    const normalized = normalizeHome(currentHome);
    return (normalized?.pantries || []) as BasicPantryFragment[];
  }, [selectedHomeId, homes]);

  // Fetch home data on demand
  const fetchHomeData = useCallback(async () => {
    // Only fetch if not already loaded
    if (!homesData) {
      await getHomes();
    }
  }, [homesData, getHomes]);

  return {
    homes,
    pantries,
    selectedHomeId,
    selectedPantryId,
    loading,
    isLoaded: !!homesData,
    fetchHomeData,
  };
}

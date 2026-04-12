import { useGetHomesLazyQuery } from '#generated';
import { useSelectedHomeId, useSelectedPantryId } from '#store/useAppStore';
import {
  normalizeHome,
  normalizeHomes,
  extractNodes,
} from '#/utils/connectionUtils';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';

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
  const selectedHomeId = useSelectedHomeId();
  const selectedPantryId = useSelectedPantryId();

  const [getHomes, { data: homesData, loading }] = useGetHomesLazyQuery({
    fetchPolicy: 'cache-first', // Use cache if available
    errorPolicy: 'ignore',
  });

  // Normalize homes data (extract nodes from connection type)
  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const rawHomes = normalizeHomes(extractNodes(homesData?.homes));
  const homes = usePreservedArrayData(rawHomes);

  // Get pantries for the current home
  let pantries: Array<{ id: string; name: string; isDefault: boolean }> = [];
  if (selectedHomeId && homes.length) {
    const currentHome = homes.find(h => h.id === selectedHomeId);
    if (currentHome) {
      const normalized = normalizeHome(currentHome);
      pantries = (normalized?.pantries || []) as Array<{
        id: string;
        name: string;
        isDefault: boolean;
      }>;
    }
  }

  // Fetch home data on demand
  const fetchHomeData = async () => {
    // Only fetch if not already loaded
    if (!homesData) {
      await getHomes();
    }
  };

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

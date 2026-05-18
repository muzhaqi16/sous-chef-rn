import { useLazyQuery } from '@apollo/client/react';
import { GetHomesDocument } from '#operations/home/home.generated';
import { useSelectedHomeId, useSelectedPantryId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';

/**
 * useLazyHomeData - Lazy-loads home data only when explicitly requested.
 *
 * Used in ShoppingListMain for "Move to Pantry" feature.
 * Prevents unnecessary home queries during shopping list refresh.
 */
export function useLazyHomeData() {
  const selectedHomeId = useSelectedHomeId();
  const selectedPantryId = useSelectedPantryId();

  const [getHomes, { data: homesData, loading }] = useLazyQuery(
    GetHomesDocument,
    {
      fetchPolicy: 'cache-first',
      errorPolicy: 'ignore',
    },
  );

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined.
  const homes = usePreservedArrayData(extractNodes(homesData?.homes));

  // Get pantries for the current home (connection edges → flat array).
  let pantries: Array<{ id: string; name: string; isDefault: boolean }> = [];
  if (selectedHomeId && homes.length) {
    const currentHome = homes.find(h => h.id === selectedHomeId) as
      | { pantriesConnection?: unknown }
      | undefined;
    pantries = extractNodes(currentHome?.pantriesConnection as never) as Array<{
      id: string;
      name: string;
      isDefault: boolean;
    }>;
  }

  const fetchHomeData = async () => {
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

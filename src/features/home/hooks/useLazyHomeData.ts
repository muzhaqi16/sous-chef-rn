import { useLazyQuery } from '@apollo/client/react';
import { GetHomesDocument } from '#operations/home/home.generated';
import { useSelectedHomeId, useSelectedPantryId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';

/**
 * useLazyHomeData - Lazy-loads home data only when explicitly requested.
 *
 * Used in ShoppingListMain for "Move to Pantry" feature.
 * Prevents unnecessary home queries during shopping list refresh.
 */
export function useLazyHomeData() {
  const selectedHomeId = useSelectedHomeId();
  const selectedPantryId = useSelectedPantryId();

  const [getHomes, { data: homesData }] = useLazyQuery(GetHomesDocument, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined
  // (preserve the connection BEFORE extracting — see usePreservedConnection).
  const homes = usePreservedNodes(homesData?.homes);

  // Pantries for the current home (connection edges → flat array).
  const pantries = selectedHomeId
    ? extractNodes(homes.find(h => h.id === selectedHomeId)?.pantriesConnection)
    : [];

  const fetchHomeData = async () => {
    if (!homesData) {
      await getHomes();
    }
  };

  return {
    homes,
    pantries,
    selectedPantryId,
    isLoaded: !!homesData,
    fetchHomeData,
  };
}

import { useQuery } from '@apollo/client/react';
import { useSelectedHomeId, useIsHomeSelectionReady } from '#store/useAppStore';
import { GetHomesDocument } from '#operations/home/home.generated';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { heldFetchPolicy } from '#hooks/apollo/standDownOptions';

/**
 * Separate from `useCurrentPantry` so a home-only consumer does not also run its
 * pantry-resolution effect, which writes `selectedPantryId`. Reads `cache-only`:
 * `useDefaultHome` owns the network fetch that populates the cache.
 */
export function useCurrentHome() {
  const selectedHomeId = useSelectedHomeId();
  const isHomeSelectionReady = useIsHomeSelectionReady();

  const { data: homesData, error } = useQuery(
    GetHomesDocument,
    heldFetchPolicy('cache-only'),
  );
  useApolloErrorLogger(GetHomesDocument, error);

  // Preserve homes (connection-shape nodes) across incomplete cache reads.
  const homes = usePreservedNodes(homesData?.homes, 'GetHomes');

  const currentHome = isHomeSelectionReady
    ? homes.find(h => h.id === selectedHomeId)
    : undefined;

  return {
    currentHome,
    // Null until the list has an answer: a failed read offline is not "no homes".
    homeCount: homesData || homes.length > 0 ? homes.length : null,
    selectedHomeId,
    isHomeSelectionReady,
  };
}

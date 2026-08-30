import { useQuery } from '@apollo/client/react';
import { useSelectedHomeId, useIsHomeSelectionReady } from '#store/useAppStore';
import { GetHomesDocument } from '#operations/home/home.generated';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';

export type CurrentHomeNode = {
  id: string;
  name?: string;
  pantriesConnection?: unknown;
  myMembership?: unknown;
};

/**
 * Separate from `useCurrentPantry` so a home-only consumer does not also run its
 * pantry-resolution effect, which writes `selectedPantryId`. Reads `cache-only`:
 * `useDefaultHome` owns the network fetch that populates the cache.
 */
export function useCurrentHome() {
  const selectedHomeId = useSelectedHomeId();
  const isHomeSelectionReady = useIsHomeSelectionReady();

  const { data: homesData } = useQuery(GetHomesDocument, {
    fetchPolicy: 'cache-only',
    errorPolicy: 'ignore',
  });

  // Preserve homes (connection-shape nodes) across incomplete cache reads.
  const homes = usePreservedNodes(homesData?.homes);

  const currentHome = isHomeSelectionReady
    ? (homes.find(h => h.id === selectedHomeId) as CurrentHomeNode | undefined)
    : undefined;

  return {
    currentHome,
    homeCount: homes.length,
    selectedHomeId,
    isHomeSelectionReady,
  };
}

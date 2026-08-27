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
 * Resolves the selected home from the cached `GetHomes` result.
 *
 * Split out of `useCurrentPantry` so consumers that only need the home — most
 * notably `usePantryPermissions` — don't also run that hook's pantry-resolution
 * effect, which writes `selectedPantryId` to the store. Mounting both on one
 * pantry screen runs that reconciliation effect twice against identical
 * inputs.
 *
 * Reads `cache-only`: `useDefaultHome` owns the network fetch and populates the
 * cache, so querying here would duplicate a request during startup.
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

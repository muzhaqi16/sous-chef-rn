/**
 * Switching which home is active. The device-local selection and the account
 * default (`Home.isDefault`) are different things and may differ;
 * `setDefaultHome` moves both. Auto-selection lives in `useDefaultHome`.
 */

import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { useApolloClient } from '@apollo/client/react';
import {
  GetHomesDocument,
  type GetHomesQuery,
} from '#operations/home/home.generated';
import { extractNodes } from '#/utils/connectionUtils';
import {
  defaultPantryOf,
  readDefaultPantryId,
} from '#features/home/utils/homePantries';
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';
import { useMarkHomeAsDefault } from '#features/home/hooks/useMarkHomeAsDefault';
import { isDefaultHomeSyncPending } from '#features/home/store/useDefaultHomeSyncStore';
import {
  useHomeState,
  useSelectedHomeId,
  useSetHomeAndPantry,
  useSetIsHomeSelectionReady,
  useSetSelectedPantryId,
} from '#store/useAppStore';
import { useStore } from '#store';

type HomeNode = GetHomesQuery['homes']['edges'][number]['node'];

interface UseHomeSelectionOptions {
  homes: HomeNode[] | null;
  remoteDefaultHomeId: string | null;
}

export function useHomeSelection({
  homes,
  remoteDefaultHomeId,
}: UseHomeSelectionOptions) {
  const selectedHomeId = useSelectedHomeId();
  const { setSelectedHomeId } = useHomeState();
  const setSelectedPantryId = useSetSelectedPantryId();
  const setHomeAndPantry = useSetHomeAndPantry();
  const setIsHomeSelectionReady = useSetIsHomeSelectionReady();

  const client = useApolloClient();
  const { markAsDefault } = useMarkHomeAsDefault();

  /**
   * Make `homeId` the account default AND switch to it. True when the change
   * stands — accepted, or queued offline. False means it was rolled back.
   */
  const setDefaultHome = async (homeId: string) => {
    // Nothing to move — unless the flag is only default because we wrote it,
    // in which case the server still has to be told.
    if (
      homeId === selectedHomeId &&
      homeId === remoteDefaultHomeId &&
      !isDefaultHomeSyncPending(homeId)
    ) {
      return true;
    }

    if (!homeId) {
      alertService.alert(t('labels.error'), t('home.invalidHomeId'));
      return false;
    }

    // Best-effort, for the pantry hint only. A home created or joined moments
    // ago is in neither the prop nor the cache, so a miss means "not visible
    // yet", never "does not exist" — the server decides.
    const homeFromProps = homes?.find(home => home.id === homeId);
    const cachedHomes = homeFromProps
      ? null
      : client.cache.readQuery({ query: GetHomesDocument });
    const targetHome =
      homeFromProps ??
      extractNodes(cachedHomes?.homes).find(home => home.id === homeId);

    // Read at call time, not from the render closure: `createHome`'s
    // `onCompleted` calls this before React re-renders, so the closure still
    // holds the pre-create selection and a rollback would deselect the new home.
    const {
      selectedHomeId: previousHomeId,
      selectedPantryId: previousPantryId,
    } = useStore.getState();

    // Closed for the transition so `GetPantry` cannot fire on the outgoing id.
    setIsHomeSelectionReady(false);
    setHomeAndPantry(homeId, defaultPantryOf(targetHome)?.id ?? null);

    const { status, serverPantry, result } = await markAsDefault(homeId);

    if (status === 'failed' || status === 'refused') {
      setHomeAndPantry(previousHomeId, previousPantryId);
      setIsHomeSelectionReady(true);
      alertService.alert(
        t('labels.error'),
        status === 'refused'
          ? localizedRefusalMessage(
              result?.data?.markHomeAsDefault,
              t('errors.setDefaultHomeFailed'),
            )
          : t('errors.setDefaultHomeFailed'),
      );
      return false;
    }

    if (serverPantry?.id) {
      setSelectedPantryId(serverPantry.id);
    } else if (!defaultPantryOf(targetHome)) {
      // Queued, or a payload with no pantry: the home may have been written to
      // the cache since, and readiness must not be declared on a home whose
      // pantry is still unresolved.
      setSelectedPantryId(readDefaultPantryId(client.cache, homeId));
    }

    setIsHomeSelectionReady(true);
    return true;
  };

  return {
    selectedHomeId,
    setDefaultHome,
    setSelectedHomeId,
    setSelectedPantryId,
  };
}

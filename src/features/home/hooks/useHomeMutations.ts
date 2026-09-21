/** Create and delete mutations for homes. Renaming lives in the detail hook. */

import { t } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  DeleteHomeDocument,
  GetHomesDocument,
} from '#operations/home/home.generated';
import { useCreateHome } from '#features/home/hooks/useCreateHome';
import { useCreatePantry } from '#features/pantry/hooks/useCreatePantry';
import { readDefaultPantryId } from '#features/home/utils/homePantries';
import { alertService } from '#/services/alertService';
import {
  useSelectedHomeId,
  useHomeState,
  useHasUnverifiedEmail,
} from '#store/useAppStore';
import { appliedPayload, isAlreadyGone } from '#/utils/errors/mutationPayload';
import { extractNodes } from '#/utils/connectionUtils';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { removeFromHomesCache } from './homeCacheUpdaters';
import { errorService } from '#/services/errorService';

interface UseHomeMutationsOptions {
  refetch: () => Promise<void>;
  setDefaultHome: (homeId: string) => Promise<boolean>;
  setSelectedPantryId: (pantryId: string | null) => void;
}

/** Home create/delete mutations. */
export function useHomeMutations({
  refetch,
  setDefaultHome,
  setSelectedPantryId,
}: UseHomeMutationsOptions) {
  const selectedHomeId = useSelectedHomeId();
  const hasUnverifiedEmail = useHasUnverifiedEmail();
  const { setSelectedHomeId } = useHomeState();
  const { createRemoveOperation } = useCrudOperations();
  const client = useApolloClient();

  // One home create, wherever it is made — the local-first one, which writes
  // the home and the creator's membership before it fires.
  const { createHome: createHomeWrite, creating } = useCreateHome(() => {
    void refetch();
  });
  // `createDefaultPantry` is forced off so no pantry carries a server-minted
  // id, which makes minting the home's first pantry this caller's job.
  const { createPantry, creating: creatingPantry } = useCreatePantry();

  const [deleteHomeMutation, { client: deleteClient }] = useMutation(
    DeleteHomeDocument,
    {
      update: (cache, { data }, { variables }) => {
        // A home the server says is already gone converges too: the settle
        // reports that as applied, so the row has to go with it.
        if ((!appliedPayload(data) && !isAlreadyGone(data)) || !variables) {
          return;
        }

        try {
          removeFromHomesCache(cache, variables.input.id, {
            evictItem: true,
          });
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for deleteHome:',
          });
          void refetch();
        }
      },
      onCompleted: (data, clientOptions) => {
        // If the deleted home was the selected one, clear it or pick another —
        // including one `update` removed as already gone.
        if (!appliedPayload(data) && !isAlreadyGone(data)) return;
        if (clientOptions?.variables?.input?.id !== selectedHomeId) return;

        // Read fresh data from Apollo cache (no refetch needed!)
        const cachedData = deleteClient.cache.readQuery({
          query: GetHomesDocument,
        });
        const remainingHomes = extractNodes(cachedData?.homes);

        const [newDefaultHome] = remainingHomes;
        if (newDefaultHome) {
          setSelectedHomeId(newDefaultHome.id);
          // Clear orphaned pantry selection - useDefaultHome will auto-select new home's default
          setSelectedPantryId(null);
          // Presents its own failure and rolls the selection back.
          void setDefaultHome(newDefaultHome.id);
        } else {
          // No homes left, clear all selections
          setSelectedHomeId(null);
          setSelectedPantryId(null);
        }
      },
    },
  );

  /**
   * Writes, then adopts the new home: its own default flag and its
   * default pantry. Adoption is keyed off the MINTED id, so it happens whether
   * the server answered or the create is queued.
   */
  const createHome = async (
    nameOrInput:
      | string
      | {
          name: string;
          allowJoinCode?: boolean;
        },
  ) => {
    const input =
      typeof nameOrInput === 'string'
        ? { name: nameOrInput, allowJoinCode: true }
        : nameOrInput;

    const outcome = await createHomeWrite({
      name: input.name.trim(),
      // The server refuses `createHome` outright when `allowJoinCode` is true
      // and the caller's email is unverified, so asking for one here would fail
      // the whole creation. Create the home without one instead; it can be
      // enabled later through `enableHomeJoinLink` once the address is verified.
      allowJoinCode: hasUnverifiedEmail ? false : input.allowJoinCode ?? true,
    });

    if (outcome.status === 'rejected') {
      alertService.alert(outcome.failure.title, outcome.failure.body);
      return false;
    }

    // The pantry is in the cache before its request leaves (the create writes
    // it first), so adoption needs nothing from the round trip. The return DOES
    // wait for it: the form closes and its button re-enables on this promise.
    const pantrySettled = createDefaultPantry(outcome.id);
    adoptNewHome(outcome.id);
    await pantrySettled;
    return true;
  };

  /**
   * Every home needs a pantry, and it is minted here so a pantry write made
   * before reconnect has a parent it can name. A refusal leaves the home
   * standing: the pantry can be added from the home's own settings.
   */
  async function createDefaultPantry(homeId: string) {
    const outcome = await createPantry({
      homeId,
      name: t('onBoarding.defaultPantryName'),
      isDefault: true,
    });
    if (outcome.status === 'rejected') {
      alertService.alert(
        outcome.failure?.title ?? t('labels.error'),
        outcome.failure?.body ?? t('errors.createPantryFailed'),
      );
    }
  }

  /**
   * A first home becomes the selection and the account default. Read from the
   * CACHE rather than a payload: a queued create has none, and the optimistic
   * write already put the home there.
   */
  function adoptNewHome(homeId: string) {
    const cachedData = client.cache.readQuery({ query: GetHomesDocument });
    const freshHomes = extractNodes(cachedData?.homes);
    const isFirstHome = freshHomes.length === 1 && freshHomes[0]?.id === homeId;
    if (!isFirstHome) return;

    setSelectedHomeId(homeId);
    // Presents its own failure; a refused default is reported where it is written.
    void setDefaultHome(homeId);

    // Adopt the new home's default pantry ONLY when we also switched to that
    // home. Unconditionally, creating a SECOND home points `selectedPantryId`
    // at a pantry in a home `selectedHomeId` does not name, and every pantry
    // watcher fires across homes until `useCurrentPantry` reconciles a render
    // later.
    const defaultPantry = readDefaultPantryId(client.cache, homeId);
    if (defaultPantry) setSelectedPantryId(defaultPantry);
  }

  const deleteHome = (homeId: string, homeName: string) => {
    const operation = createRemoveOperation({
      mutation: deleteHomeMutation,
      document: DeleteHomeDocument,
      fallback: t('errors.deleteHomeFailed'),
      itemId: homeId,
      confirmTitle: t('confirmations.deleteHomeTitle'),
      confirmMessage: t('labels.areYouSureYouWantToDeleteThisCannotBeUndone', {
        name: homeName,
      }),
    });
    return operation();
  };

  return {
    createHome,
    deleteHome,
    // The default pantry's round trip is part of creating a home: the submit
    // control stays disabled until both have settled.
    creating: creating || creatingPantry,
  };
}

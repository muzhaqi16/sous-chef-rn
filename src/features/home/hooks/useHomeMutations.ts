/** Create and delete mutations for homes. Renaming lives in the detail hook. */

import type { ErrorLike } from '@apollo/client';
import { t } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  DeleteHomeDocument,
  GetHomesDocument,
} from '#operations/home/home.generated';
import { useCreateHome } from '#features/home/hooks/useCreateHome';
import { readDefaultPantryId } from '#features/home/utils/homePantries';
import { alertService } from '#/services/alertService';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import {
  useSelectedHomeId,
  useHomeState,
  useHasUnverifiedEmail,
} from '#store/useAppStore';
import { handleMutationError } from '#/utils/errorHandlers';
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
    void refetch?.();
  });

  const [deleteHomeMutation, { loading: deleting, client: deleteClient }] =
    useMutation(DeleteHomeDocument, {
      update: (cache, { data }, { variables }) => {
        if (
          data?.deleteHome?.__typename !== 'DeleteHomePayload' ||
          !variables
        ) {
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
          refetch?.();
        }
      },
      onCompleted: async data => {
        if (data?.deleteHome?.__typename === 'DeleteHomePayload') {
          // If deleted home was the default, clear it or set another
          if (data.deleteHome.home.id === selectedHomeId) {
            // Read fresh data from Apollo cache (no refetch needed!)
            const cachedData = deleteClient.cache.readQuery({
              query: GetHomesDocument,
            });
            const remainingHomes = extractNodes(cachedData?.homes);

            const [newDefaultHome] = remainingHomes;
            if (newDefaultHome) {
              // Set first remaining home as default
              setSelectedHomeId(newDefaultHome.id);
              // Clear orphaned pantry selection - useDefaultHome will auto-select new home's default
              setSelectedPantryId(null);
              void setDefaultHome(newDefaultHome.id).then(ok => {
                if (!ok) {
                  handleMutationError(
                    new Error('markHomeAsDefault refused after delete'),
                    {
                      operation: 'Set Default Home After Delete',
                      showAlert: false,
                    },
                  );
                }
              });
            } else {
              // No homes left, clear all selections
              setSelectedHomeId(null);
              setSelectedPantryId(null);
            }
          }
        }
      },
      onError: (error: ErrorLike) => {
        handleMutationError(error, { operation: 'Delete Home' });
      },
    });

  /**
   * Validates, writes, then adopts the new home: its own default flag and its
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

    if (!input.name?.trim()) {
      alertService.alert(
        t('labels.validationError'),
        t('homeDetail.homeNameEmptyError'),
      );
      return false;
    }

    const outcome = await createHomeWrite({
      name: input.name.trim(),
      // The server refuses `createHome` outright when `allowJoinCode` is true
      // and the caller's email is unverified, so asking for one here would fail
      // the whole creation. Create the home without one instead; it can be
      // enabled later through `enableHomeJoinLink` once the address is verified.
      allowJoinCode: hasUnverifiedEmail ? false : input.allowJoinCode ?? true,
    });

    if (outcome.status === 'rejected') {
      // The caller's copy is the FALLBACK; the refusal's own code selects the
      // localized line.
      alertRejectedMutation(outcome.result, t('errors.createHomeFailed'));
      return false;
    }

    adoptNewHome(outcome.id);
    return true;
  };

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
    // `setDefaultHome` resolves false on a refusal rather than rejecting, so
    // the status is the only signal there is.
    void setDefaultHome(homeId).then(ok => {
      if (!ok) {
        handleMutationError(
          new Error('markHomeAsDefault refused for first home'),
          { operation: 'Set First Home as Default', showAlert: false },
        );
      }
    });

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
      itemId: homeId,
      confirmTitle: t('confirmations.deleteHomeTitle'),
      confirmMessage: t('labels.areYouSureYouWantToDeleteThisCannotBeUndone', {
        name: homeName,
      }),
      operationName: 'Delete Home',
    });
    return operation();
  };

  return {
    createHome,
    deleteHome,
    creating,
    deleting,
  };
}

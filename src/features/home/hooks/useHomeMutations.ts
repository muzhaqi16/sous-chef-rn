/** Create and delete mutations for homes. Renaming lives in the detail hook. */

import type { ErrorLike } from '@apollo/client';
import { t } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import {
  CreateHomeDocument,
  DeleteHomeDocument,
  GetHomesDocument,
  type CreateHomeMutation,
} from '#operations/home/home.generated';
import {
  useSelectedHomeId,
  useHomeState,
  useHasUnverifiedEmail,
} from '#store/useAppStore';
import { handleMutationError } from '#/utils/errorHandlers';
import { extractNodes } from '#/utils/connectionUtils';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { addToHomesCache, removeFromHomesCache } from './homeCacheUpdaters';
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
  const { createAddOperation, createRemoveOperation } = useCrudOperations();

  const [createHomeMutation, { loading: creating, client }] = useMutation(
    CreateHomeDocument,
    {
      // Note: No optimisticResponse - the mutation returns complex nested types that are difficult to predict
      update: (cache, { data }) => {
        if (data?.createHome?.__typename !== 'CreateHomePayload') return;
        const newHome = data.createHome.home;

        try {
          addToHomesCache(cache, newHome, { position: 'end' });
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for createHome:',
          });
          refetch?.();
        }
      },
      onCompleted: async data => {
        if (data?.createHome?.__typename === 'CreateHomePayload') {
          const newHome = data.createHome.home;

          // Read fresh data from Apollo cache (no refetch needed!)
          const cachedData = client.cache.readQuery({
            query: GetHomesDocument,
          });
          const freshHomes = extractNodes(cachedData?.homes);

          // Only set as default if this is truly the first/only home
          const isFirstHome =
            freshHomes.length === 1 && freshHomes[0].id === newHome.id;

          if (isFirstHome) {
            setSelectedHomeId(newHome.id);
            // `setDefaultHome` resolves false on a refusal rather than
            // rejecting, so the status is the only signal there is.
            void setDefaultHome(newHome.id).then(ok => {
              if (!ok) {
                handleMutationError(
                  new Error('markHomeAsDefault refused for first home'),
                  { operation: 'Set First Home as Default', showAlert: false },
                );
              }
            });

            // Adopt the new home's default pantry ONLY when we also switched
            // to that home. Unconditionally, creating a SECOND home points
            // `selectedPantryId` at a pantry in a home `selectedHomeId` does
            // not name, and every pantry watcher fires across homes until
            // `useCurrentPantry` reconciles a render later.
            const pantries = extractNodes(newHome.pantriesConnection);
            const defaultPantry = pantries.find(p => p.isDefault);
            if (defaultPantry) {
              setSelectedPantryId(defaultPantry.id);
            }
          }
        }
      },
      onError: (error: ErrorLike) => {
        handleMutationError(error, { operation: 'Create Home' });
      },
    },
  );

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

            if (remainingHomes.length > 0) {
              // Set first remaining home as default
              const newDefaultHome = remainingHomes[0];
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

  // Helper functions using CRUD utilities
  const createHomeOperation = createAddOperation({
    mutation: createHomeMutation,
    transformInput: (input: {
      name: string;
      createDefaultPantry?: boolean;
      allowJoinCode?: boolean;
    }) => ({
      name: input.name.trim(),
      createDefaultPantry: input.createDefaultPantry ?? true,
      // The server refuses `createHome` outright when `allowJoinCode` is true
      // and the caller's email is unverified, so asking for one here would fail
      // the whole creation — including onboarding, which requests a join code
      // unconditionally. Create the home without one instead; it can be enabled
      // later through `enableHomeJoinLink` once the address is verified.
      allowJoinCode: hasUnverifiedEmail ? false : input.allowJoinCode ?? true,
    }),
    validateInput: (input: { name: string }) => {
      if (!input.name?.trim()) {
        return t('homeDetail.homeNameEmptyError');
      }
      return true;
    },
    onSuccess: (data: CreateHomeMutation) =>
      data?.createHome?.__typename === 'CreateHomePayload'
        ? data.createHome.home
        : undefined,
    operationName: 'Create Home',
  });

  // Wrapper to support both string and object signatures
  const createHome = async (
    nameOrInput:
      | string
      | {
          name: string;
          createDefaultPantry?: boolean;
          allowJoinCode?: boolean;
        },
  ) => {
    const input =
      typeof nameOrInput === 'string'
        ? { name: nameOrInput, createDefaultPantry: true, allowJoinCode: true }
        : nameOrInput;
    return createHomeOperation(input);
  };

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

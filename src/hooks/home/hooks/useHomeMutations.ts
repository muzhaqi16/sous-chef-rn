/**
 * useHomeMutations - CRUD mutations for homes
 *
 * Single responsibility:
 * - Create, update, delete home mutations
 * - Optimistic responses and cache updates
 * - Error handling with user feedback
 */

import type { ErrorLike } from '@apollo/client';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  CreateHomeDocument,
  UpdateHomeDocument,
  DeleteHomeDocument,
  GetHomesDocument,
  type CreateHomeMutation,
} from '#operations/home/home.generated';
import { UpdateHomeOptimistic_HomeFragmentDoc } from './useHomeMutations.generated';
import {
  useSelectedHomeId,
  useHomeState,
  useHasUnverifiedEmail,
} from '#store/useAppStore';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { extractNodes } from '#/utils/connectionUtils';
import { buildOptimisticMutationResponse } from '#/apollo/utils/createOptimisticResponse';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { addToHomesCache, removeFromHomesCache } from './utils';
import { errorService } from '#/services/errorService';

interface UseHomeMutationsOptions {
  refetch: () => Promise<void>;
  setDefaultHome: (homeId: string) => Promise<boolean>;
  setSelectedPantryId: (pantryId: string | null) => void;
}

/**
 * Hook for home CRUD operations
 *
 * @example
 * ```tsx
 * const { createHome, updateHome, deleteHome, creating, updating, deleting } = useHomeMutations({
 *   refetch,
 *   setDefaultHome,
 *   setSelectedPantryId,
 * });
 * ```
 */
export function useHomeMutations({
  refetch,
  setDefaultHome,
  setSelectedPantryId,
}: UseHomeMutationsOptions) {
  const selectedHomeId = useSelectedHomeId();
  const hasUnverifiedEmail = useHasUnverifiedEmail();
  const { setSelectedHomeId } = useHomeState();
  const { createAddOperation, createRemoveOperation } = useCrudOperations();
  const apolloClient = useApolloClient();

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
          if (freshHomes.length === 1 && freshHomes[0].id === newHome.id) {
            setSelectedHomeId(newHome.id);
            setDefaultHome(newHome.id).catch((error: unknown) => {
              console.warn(
                'Failed to set newly created home as default:',
                error,
              );
            });
          }

          // If a default pantry was created, set it as selected
          const pantries = extractNodes(newHome.pantriesConnection);
          const defaultPantry = pantries.find(p => p.isDefault);
          if (defaultPantry) {
            setSelectedPantryId(defaultPantry.id);
          }
        }
      },
      onError: (error: ErrorLike) => {
        handleMutationError(error, { operation: 'Create Home' });
      },
    },
  );

  const [updateHomeMutation, { loading: updating }] = useMutation(
    UpdateHomeDocument,
    {
      optimisticResponse: (variables, { IGNORE }) => {
        // Read the home's current payload fields from cache (populated by the
        // home-detail query). Without them we can't predict the response shape.
        const current = apolloClient.cache.readFragment({
          id: apolloClient.cache.identify({
            __typename: 'Home',
            id: variables.input.id,
          }),
          fragment: UpdateHomeOptimistic_HomeFragmentDoc,
        });
        if (!current) return IGNORE;
        // Enabling a join code mints a server-generated code — wait for the
        // server rather than predicting it. Every other field is known.
        if (variables.input.allowJoinCode === true && !current.joinCode) {
          return IGNORE;
        }
        return buildOptimisticMutationResponse(
          'updateHome',
          'UpdateHomePayload',
          {
            home: {
              __typename: current.__typename,
              id: current.id,
              name: variables.input.name ?? current.name,
              allowJoinCode:
                variables.input.allowJoinCode ?? current.allowJoinCode,
              joinCode: current.joinCode,
              version: current.version,
              updatedAt: new Date().toISOString(),
            },
          },
        );
      },
      onCompleted: data => {
        if (data?.updateHome?.__typename === 'UpdateHomePayload') {
          toastService.success(t('success.homeUpdated'));
        }
      },
      onError: (error: ErrorLike) => {
        handleMutationError(error, {
          operation: 'Update Home',
          checks: [
            versionConflictCheck({
              itemName: t('errors.entityHome'),
              onRefresh: () => refetch(),
            }),
          ],
        });
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
              setDefaultHome(newDefaultHome.id).catch((error: unknown) => {
                console.warn(
                  'Failed to set new default home after delete:',
                  error,
                );
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
        return 'Please enter a home name';
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

  const updateHome = async (
    homeId: string,
    updates: { name?: string; isDefault?: boolean; allowJoinCode?: boolean },
  ) => {
    // Handle default home update separately if needed
    if (updates.isDefault !== undefined && updates.isDefault) {
      let defaultResult;
      try {
        defaultResult = await setDefaultHome(homeId);
      } catch (error) {
        errorService.reportError(error, {
          operation: 'Set default home error:',
        });
      }
      if (defaultResult === false) return false;
      delete updates.isDefault; // Remove from updates since we handle it separately
    }

    if (Object.keys(updates).length > 0) {
      let result;
      try {
        result = await updateHomeMutation({
          variables: {
            input: { ...updates, id: homeId },
          },
        });
      } catch (error) {
        errorService.reportError(error, {
          operation: 'Update home error:',
        });
      }
      if (!result) return false;

      return result.data?.updateHome?.__typename === 'UpdateHomePayload'
        ? result.data.updateHome.home
        : false;
    }

    return true;
  };

  const deleteHome = (homeId: string, homeName: string) => {
    const operation = createRemoveOperation({
      mutation: deleteHomeMutation,
      itemId: homeId,
      confirmMessage: 'Are you sure you want to delete "{name}"?',
      itemName: homeName,
      operationName: 'Delete Home',
    });
    return operation();
  };

  return {
    createHome,
    updateHome,
    deleteHome,
    creating,
    updating,
    deleting,
  };
}

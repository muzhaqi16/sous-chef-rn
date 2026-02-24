/**
 * useHomeMutations - CRUD mutations for homes
 *
 * Single responsibility:
 * - Create, update, delete home mutations
 * - Optimistic responses and cache updates
 * - Error handling with user feedback
 */

import { Alert } from 'react-native';
import type { ErrorLike } from '@apollo/client';
import { useShallow } from 'zustand/shallow';
import {
  useCreateHomeMutation,
  useUpdateHomeMutation,
  useDeleteHomeMutation,
  GetHomesDocument,
} from '#generated';
import {
  useAppStore,
  selectSelectedHomeId,
  selectHomeState,
} from '#store/useAppStore';
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { normalizeHome } from '#/utils/connectionUtils';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { addToHomesCache, removeFromHomesCache } from './utils';

interface UseHomeMutationsOptions {
  homes: any[] | null;
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
 *   homes,
 *   refetch,
 *   setDefaultHome,
 *   setSelectedPantryId,
 * });
 * ```
 */
export function useHomeMutations({
  homes,
  refetch,
  setDefaultHome,
  setSelectedPantryId,
}: UseHomeMutationsOptions) {
  const selectedHomeId = useAppStore(selectSelectedHomeId);
  const { setSelectedHomeId } = useAppStore(useShallow(selectHomeState));
  const { handleApolloError } = useErrorService();
  const { createAddOperation, createRemoveOperation } = useCrudOperations();

  const [createHomeMutation, { loading: creating, client }] =
    useCreateHomeMutation({
      errorPolicy: 'all',
      // Note: No optimisticResponse - the mutation returns complex nested types that are difficult to predict
      update: (cache, { data }) => {
        if (!data?.createHome?.home) return;

        try {
          addToHomesCache(cache, data.createHome.home, { position: 'end' });
        } catch (error) {
          console.warn('Cache update failed for createHome:', error);
          refetch();
        }
      },
      onCompleted: async data => {
        if (data?.createHome?.home) {
          const newHome = data.createHome.home;

          // Read fresh data from Apollo cache (no refetch needed!)
          const cachedData = client.cache.readQuery({
            query: GetHomesDocument,
          }) as { homes: any[] } | null;
          const freshHomes = cachedData?.homes ?? [];

          // Only set as default if this is truly the first/only home
          if (freshHomes.length === 1 && freshHomes[0].id === newHome.id) {
            setSelectedHomeId(newHome.id);
            setDefaultHome(newHome.id).catch((error: any) => {
              console.warn('Failed to set newly created home as default:', error);
            });
          }

          // If a default pantry was created, set it as selected
          const normalizedNewHome = normalizeHome(newHome);
          if (normalizedNewHome?.pantries?.length) {
            const defaultPantry = normalizedNewHome.pantries.find(
              (pantry: any) => pantry.isDefault,
            );
            if (defaultPantry) {
              setSelectedPantryId(defaultPantry.id);
            }
          }
        }
      },
      onError: (error: ErrorLike) => {
        const { message } = handleApolloError(error, {
          operation: 'Create Home',
        });
        Alert.alert('Error', message);
      },
    });

  const [updateHomeMutation, { loading: updating }] = useUpdateHomeMutation({
    errorPolicy: 'all',
    optimisticResponse: (variables, { IGNORE }) => {
      const currentHome = homes?.find((h: any) => h.id === variables.id);
      if (!currentHome) return IGNORE;

      return {
        __typename: 'Mutation',
        updateHome: {
          __typename: 'HomePayload',
          success: true,
          message: 'Home updated successfully',
          code: 'HOME_UPDATED',
          home: enhanceWithVersion(currentHome, variables.input),
        },
      };
    },
    onCompleted: data => {
      if (data?.updateHome?.home) {
        Alert.alert('Success', 'Home updated successfully');
      }
    },
    onError: (error: ErrorLike) => {
      if (handleVersionConflict(error)) {
        Alert.alert('Home Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      const { message } = handleApolloError(error, {
        operation: 'Update Home',
      });
      Alert.alert('Error', message);
    },
  });

  const [deleteHomeMutation, { loading: deleting, client: deleteClient }] =
    useDeleteHomeMutation({
      update: (cache, { data }, { variables }) => {
        if (!data?.deleteHome?.success || !variables) return;

        try {
          const deletedHomeId = variables.id;
          removeFromHomesCache(cache, deletedHomeId, { evictItem: true });
        } catch (error) {
          console.warn('Cache update failed for deleteHome:', error);
          refetch();
        }
      },
      onCompleted: async data => {
        if (data?.deleteHome?.success) {
          // If deleted home was the default, clear it or set another
          if (data.deleteHome.home?.id === selectedHomeId) {
            // Read fresh data from Apollo cache (no refetch needed!)
            const cachedData = deleteClient.cache.readQuery({
              query: GetHomesDocument,
            }) as { homes: any[] } | null;
            const remainingHomes = cachedData?.homes ?? [];

            if (remainingHomes.length > 0) {
              // Set first remaining home as default
              const newDefaultHome = remainingHomes[0];
              setSelectedHomeId(newDefaultHome.id);
              // Clear orphaned pantry selection - useDefaultHome will auto-select new home's default
              setSelectedPantryId(null);
              setDefaultHome(newDefaultHome.id).catch((error: any) => {
                console.warn('Failed to set new default home after delete:', error);
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
        const { message } = handleApolloError(error, {
          operation: 'Delete Home',
        });
        Alert.alert('Error', message);
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
      allowJoinCode: input.allowJoinCode ?? true,
    }),
    validateInput: (input: { name: string }) => {
      if (!input.name?.trim()) {
        return 'Please enter a home name';
      }
      return true;
    },
    onSuccess: (data: any) => data?.createHome?.home,
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
    updates: { name?: string; isDefault?: boolean },
  ) => {
    try {
      // Handle default home update separately if needed
      if (updates.isDefault !== undefined && updates.isDefault) {
        await setDefaultHome(homeId);
        delete updates.isDefault; // Remove from updates since we handle it separately
      }

      if (Object.keys(updates).length > 0) {
        const result = await updateHomeMutation({
          variables: {
            id: homeId,
            input: updates,
          },
        });

        return result.data?.updateHome?.home || false;
      }

      return true;
    } catch {
      return false;
    }
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

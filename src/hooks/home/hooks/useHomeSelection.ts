/**
 * useHomeSelection - Default home selection logic
 *
 * Single responsibility:
 * - Auto-select first home for new users
 * - Sync default home to server
 * - Handle home switching with pantry coordination
 */

import { useEffect, useRef } from 'react';
import { alertService } from '#/services/alertService';
import { useMutation } from '@apollo/client/react';
import {
  MarkHomeAsDefaultDocument,
  type MarkHomeAsDefaultMutation,
} from '#operations/home/userSettings.generated';
import type { GetHomesQuery } from '#operations/home/home.generated';
import type { Reference } from '@apollo/client';
import {
  useHomeState,
  useSelectedHomeId,
  useSelectedPantryId,
  useSetHomeAndPantry,
  useSetIsHomeSelectionReady,
  useSetSelectedPantryId,
} from '#store/useAppStore';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';

/**
 * Home node as returned by `GetHomes` (via `extractNodes`), widened with an
 * optional flat `pantries` array for legacy callers that pass the pre-connection
 * shape. Pantry lookups read either `pantries` or `pantriesConnection`.
 */
type HomeNode = GetHomesQuery['homes']['edges'][number]['node'] & {
  pantries?: Array<{ id: string; isDefault?: boolean }>;
};

/**
 * Cached `homes` connection edge. May be a normalized `{ node: Reference }`
 * wrapper or, defensively, a bare `Reference` in older persisted shapes.
 */
type HomeEdge = { node?: Reference } | Reference;

interface UseHomeSelectionOptions {
  homes: HomeNode[] | null;
  remoteDefaultHomeId: string | null;
  loading: boolean;
}

/**
 * Hook for managing home selection and default home logic
 *
 * Handles:
 * - Auto-selection for first-time users
 * - Syncing default home to server
 * - Switching between homes with pantry coordination
 *
 * @example
 * ```tsx
 * const { selectedHomeId, setDefaultHome, defaultHome, isSynced } = useHomeSelection({
 *   homes,
 *   remoteDefaultHomeId,
 *   loading,
 * });
 * ```
 */
export function useHomeSelection({
  homes,
  remoteDefaultHomeId,
  loading,
}: UseHomeSelectionOptions) {
  const selectedHomeId = useSelectedHomeId();
  const { setSelectedHomeId } = useHomeState();
  const selectedPantryId = useSelectedPantryId();
  const setSelectedPantryId = useSetSelectedPantryId();
  const setHomeAndPantry = useSetHomeAndPantry();
  const setIsHomeSelectionReady = useSetIsHomeSelectionReady();

  // Ref to track if initial home auto-selection has been attempted
  const hasInitializedDefaultHome = useRef(false);

  const [setDefaultHomeMutation] = useMutation(MarkHomeAsDefaultDocument, {
    // Optimistic response for instant UI updates (especially offline)
    optimisticResponse: (variables): MarkHomeAsDefaultMutation => ({
      __typename: 'Mutation',
      markHomeAsDefault: {
        __typename: 'MarkHomeAsDefaultPayload',
        settings: {
          __typename: 'UserSettings',
          id: variables.input.homeId,
        },
        defaultPantry: null,
      },
    }),

    // Update Apollo cache to set isDefault on the correct home
    update: (cache, _result, { variables }) => {
      if (!variables?.input.homeId) return;

      // Update isDefault field on all homes in cache
      cache.modify({
        fields: {
          homes(
            existingHomes: { edges?: HomeEdge[]; readonly __ref?: string },
            { readField },
          ) {
            // Handle connection type: homes has { edges: [...] }
            if (!existingHomes || !existingHomes.edges) {
              return existingHomes;
            }

            // Iterate through edges to update isDefault on each home
            existingHomes.edges.forEach((edge: HomeEdge) => {
              const homeRef = ('node' in edge && edge.node) || edge;
              if (!homeRef) return;

              const homeId = readField('id', homeRef);
              const cacheId = cache.identify(homeRef);

              if (cacheId) {
                cache.modify({
                  id: cacheId,
                  fields: {
                    isDefault: () => homeId === variables.input.homeId,
                  },
                });
              }
            });

            // Return existing unchanged - we modified entities directly
            return existingHomes;
          },
        },
      });
    },
  });

  // Auto-select first home if no default is set and we have homes (initialization for first-time users)
  // This runs ONCE when the user has homes but no default home set anywhere
  useEffect(() => {
    if (
      !hasInitializedDefaultHome.current &&
      !selectedHomeId &&
      !remoteDefaultHomeId &&
      !loading &&
      homes &&
      homes.length > 0
    ) {
      hasInitializedDefaultHome.current = true; // Mark as done
      const firstHome = homes[0];
      setSelectedHomeId(firstHome.id);

      // Sync this choice to the backend
      setDefaultHomeMutation({
        variables: { input: { homeId: firstHome.id } },
      }).catch(error => {
        handleMutationError(error, {
          operation: 'Set First Home as Default',
          showAlert: false,
        });
      });
    }
  }, [
    selectedHomeId,
    remoteDefaultHomeId,
    loading,
    homes?.length, // Use primitive to prevent re-runs when array reference changes
    setDefaultHomeMutation,
    setSelectedHomeId,
    homes,
  ]);

  const setDefaultHome = async (homeId: string) => {
    // Prevent redundant calls if already set as default (check both local and remote)
    if (homeId === selectedHomeId && homeId === remoteDefaultHomeId) {
      return true;
    }

    // Validate homeId exists
    if (!homeId) {
      alertService.alert('Error', 'Invalid home ID');
      return false;
    }

    // Find the target home and its default pantry BEFORE mutation
    // This prevents race condition where cache updates but Zustand hasn't
    const targetHome = homes?.find(home => home.id === homeId);
    if (!targetHome) {
      alertService.alert('Error', 'Home not found');
      return false;
    }

    // Get the default pantry from home data we already have
    const localDefaultPantry =
      targetHome.pantries?.find(p => p.isDefault) || targetHome.pantries?.[0];

    // Store old values for potential rollback
    const previousHomeId = selectedHomeId;
    const previousPantryId = selectedPantryId;

    // 1. Gate all pantry queries by setting ready flag to false
    // This prevents GetPantry from firing with invalid id during the transition
    setIsHomeSelectionReady(false);

    // 2. Update home and pantry - safe to set null because queries are gated
    // This clears old pantry data to avoid showing wrong home's items
    setHomeAndPantry(homeId, localDefaultPantry?.id ?? null);

    const result = await executeMutation(
      () =>
        setDefaultHomeMutation({
          variables: { input: { homeId } },
        }),
      () => {
        // Rollback on error and re-enable queries
        setHomeAndPantry(previousHomeId, previousPantryId);
        setIsHomeSelectionReady(true);
        alertService.alert('Error', 'Failed to set default home');
      },
    );
    if (!result) return false;

    if (
      result.data?.markHomeAsDefault?.__typename === 'MarkHomeAsDefaultPayload'
    ) {
      // Update pantry from server response (server is source of truth)
      const serverPantry = result.data.markHomeAsDefault.defaultPantry;
      if (serverPantry?.id) {
        setSelectedPantryId(serverPantry.id);
      }
      // 3. Re-enable queries now that we have valid pantryId
      setIsHomeSelectionReady(true);
      return true;
    }

    // A resolved `*Error` union member (or no data) doesn't throw under
    // errorPolicy:'all', so the executeMutation error callback above never
    // fired. Roll back, re-enable queries, and surface it (mirrors the throw
    // path; the early `if (!result) return false` keeps the two exclusive).
    setHomeAndPantry(previousHomeId, previousPantryId);
    setIsHomeSelectionReady(true);
    alertService.alert('Error', 'Failed to set default home');
    return false;
  };

  // Computed value for current default home
  const defaultHome = homes?.find(home => home.id === selectedHomeId) || null;
  const isSynced = selectedHomeId === remoteDefaultHomeId;

  return {
    selectedHomeId,
    defaultHome,
    isSynced,
    setDefaultHome,
    setDefaultHomeMutation,
    setSelectedHomeId,
    setSelectedPantryId,
  };
}

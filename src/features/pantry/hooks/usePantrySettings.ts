import { useApolloClient, useQuery, useMutation } from '@apollo/client/react';
import { isSuccessPayload } from '#/utils/errors/mutationPayload';
import type { ApolloCache } from '@apollo/client';
import {
  GetPantryDocument,
  UpdatePantryDocument,
  DeletePantryDocument,
  MarkPantryAsDefaultDocument,
  type DeletePantryMutation,
  type DeletePantryMutationVariables,
} from '#features/pantry/graphql/pantry.generated';
import {
  useCreatePantry,
  type PantryWriteOutcome,
} from '#features/pantry/hooks/useCreatePantry';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { classifyDeleteResult } from '#/apollo/utils/classifyCreateResult';
import {
  removeOptimisticPantry,
  restorePantryToHomeCache,
} from '#features/pantry/utils/optimisticPantry';
import { handleMutationError } from '#/utils/errorHandlers';
import { errorService } from '#/services/errorService';
import { logger } from '#/utils/environment';

/** Module-level so the try/catch does not bail the hook out of the compiler. */
function buildDeletePantryUpdater(homeId: string | null | undefined) {
  return function deletePantryUpdater(
    cache: ApolloCache,
    { data }: { data?: DeletePantryMutation | null },
    { variables }: { variables?: DeletePantryMutationVariables },
  ) {
    // Keyed off the VARIABLES: `DeletePantryPayload.pantry` is null when the
    // server converges a replay, exactly the case this has to handle.
    const isDeletePayload =
      data?.deletePantry?.__typename === 'DeletePantryPayload';
    if (!isDeletePayload || !variables?.input?.id || !homeId) return;
    try {
      removeOptimisticPantry(cache, homeId, variables.input.id);
    } catch (error) {
      logger.warn('Cache update failed for deletePantry:', error);
    }
  };
}

interface UsePantrySettingsArgs {
  pantryId: string | undefined;
  homeId: string | null | undefined;
}

/** The pantry a settings screen reads, and every write it can make to it. */
export function usePantrySettings({ pantryId, homeId }: UsePantrySettingsArgs) {
  const client = useApolloClient();
  // The create is `useCreatePantry`'s — one pantry create, wherever it is made.
  const { createPantry } = useCreatePantry();
  // Gates the `pantryId!` assertion below.
  const hasValidPantryId = !!pantryId?.trim();

  const {
    data: pantryData,
    loading: loadingPantry,
    error: pantryError,
  } = useQuery(GetPantryDocument, {
    variables: { id: pantryId!, itemsFirst: 25, storageLocationsFirst: 15 },
    skip: !hasValidPantryId,
  });

  const pantry = pantryData?.pantry;

  const [updatePantry] = useMutation(UpdatePantryDocument, {
    // No `update`: Apollo merges the returned Pantry entity, and membership
    // lists are unchanged by an edit.
  });

  const [markAsDefault] = useMutation(MarkPantryAsDefaultDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Set Default Pantry' });
    },
  });

  const [deletePantryMutation] = useMutation(DeletePantryDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Delete Pantry' });
    },
    update: buildDeletePantryUpdater(homeId),
  });

  /** False when the flag did not stick, so the caller can put its switch back. */
  const setDefault = async (id: string): Promise<boolean> => {
    let result;
    let threw = false;
    try {
      result = await markAsDefault({
        variables: { input: { id } },
        // Absolute flag on an existing row, so a replay lands the same state.
        context: { localFirst: true },
      });
    } catch (error) {
      threw = true;
      errorService.reportError(error, {
        operation: 'PantrySettings.setDefaultPantry',
      });
    }
    // `errorPolicy: 'all'` puts a GraphQL error on `result.error`, but a REFUSAL
    // arrives as a union member in `data` and sets no error at all — so the
    // payload has to be discriminated or a refused write reports as saved.
    return (
      !threw &&
      isSuccessPayload(
        result?.data?.markPantryAsDefault,
        'MarkPantryAsDefaultPayload',
      )
    );
  };

  /**
   * Absolute field write on an existing row, so a replay lands the same state —
   * safe to queue, and the rename shows immediately.
   */
  const savePantryFields = (
    id: string,
    updates: { name: string; description: string },
  ) =>
    updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: { __typename: 'Pantry', id },
      updates,
      // Omits keys the read did not carry, so a refusal arriving before the
      // query resolves reverts nothing. `pantry?.name ?? ''` would instead
      // write an empty name over the real one.
      previous: snapshotFields(pantry, updates),
      logLabel: 'PantrySettings.updatePantry',
      mutate: () =>
        updatePantry({
          variables: { input: { id, ...updates } },
          context: { localFirst: true },
        }),
    });

  /** Unlinks without evicting, so a refusal can put the row back. */
  const deletePantry = async (id: string): Promise<PantryWriteOutcome> => {
    // Written HERE, before firing: offline there is no `DeletePantryPayload`,
    // so `buildDeletePantryUpdater` never runs and the queued replay carries no
    // `update` at all.
    if (homeId) {
      try {
        removeOptimisticPantry(client.cache, homeId, id, {
          evictEntity: false,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Delete Pantry (optimistic)',
        });
      }
    }

    // Safe to queue: the delete converges server-side on replay
    // (`converged: true` for an already-deleted row).
    const result = await deletePantryMutation({
      variables: { input: { id } },
      context: { localFirst: true },
    });

    // A delete CONVERGES: an already-deleted pantry answers with a success
    // payload, and an id the server never held with NotFoundError. Both leave
    // the row gone, which is what was asked for — reverting the second would
    // restore a pantry the server cannot send.
    if (classifyDeleteResult(result) !== 'rejected') {
      return { status: 'ok', rejectionMessage: null, result };
    }

    if (homeId) {
      try {
        restorePantryToHomeCache(client.cache, homeId, id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Pantry delete',
        });
      }
    }
    return { status: 'rejected', rejectionMessage: null, result };
  };

  return {
    pantry,
    pantryItemCount: pantry?.itemsConnection?.totalCount ?? 0,
    loadingPantry,
    pantryError,
    setDefault,
    createPantry,
    savePantryFields,
    deletePantry,
  };
}

import { useApolloClient, useQuery, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  GetPantryDocument,
  UpdatePantryDocument,
  DeletePantryDocument,
  CreatePantryDocument,
  MarkPantryAsDefaultDocument,
  type DeletePantryMutation,
  type DeletePantryMutationVariables,
  type CreatePantryMutation,
} from '#features/pantry/graphql/pantry.generated';
import type { CreatePantryInput } from '#/graphql/generated/schemaTypes';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  addPantryToHomeCache,
  buildOptimisticPantry,
  removeOptimisticPantry,
  restorePantryToHomeCache,
  writeOptimisticPantry,
} from '#features/pantry/utils/optimisticPantry';
import { handleMutationError } from '#/utils/errorHandlers';
import { errorService } from '#/services/errorService';
import { generateEntityId } from '#/utils/generateEntityId';
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

/** Module-level so the try/catch does not bail the hook out of the compiler.
 *  Idempotent by pantry id — the pre-fire write already inserted the same one. */
function buildCreatePantryUpdater(homeId: string | null | undefined) {
  return function createPantryUpdater(
    cache: ApolloCache,
    { data }: { data?: CreatePantryMutation | null },
  ) {
    const newPantry =
      data?.createPantry?.__typename === 'CreatePantryPayload'
        ? data.createPantry.pantry
        : null;
    if (!newPantry || !homeId) return;
    try {
      addPantryToHomeCache(cache, homeId, newPantry);
    } catch (error) {
      logger.warn('Cache update failed for createPantry:', error);
    }
  };
}

/** A write's verdict, plus the refusal copy the caller reports. */
export interface PantryWriteOutcome {
  status: 'ok' | 'rejected';
  /** The payload's own message, when the server sent one. */
  rejectionMessage: string | null;
  /** Carried so the caller can resolve LOCALIZED copy from `errors.field.*`. */
  result: { data?: unknown; error?: unknown };
}

interface UsePantrySettingsArgs {
  pantryId: string | undefined;
  homeId: string | null | undefined;
}

/** The pantry a settings screen reads, and every write it can make to it. */
export function usePantrySettings({ pantryId, homeId }: UsePantrySettingsArgs) {
  const client = useApolloClient();
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

  const [createPantryMutation] = useMutation(CreatePantryDocument, {
    update: buildCreatePantryUpdater(homeId),
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
    return !threw && !!result && !result.error;
  };

  /**
   * Mint the row's real PK and write the complete pantry before firing, so
   * creation works offline and takes items at once. Online echoes the same id
   * and a queued replay is keyed by it, so the caller can select it either way.
   */
  const createPantry = async (
    fields: Omit<CreatePantryInput, 'id'>,
  ): Promise<PantryWriteOutcome & { id: string }> => {
    const id = generateEntityId();
    const input = { ...fields, id };
    const optimisticPantry = buildOptimisticPantry(id, input);
    try {
      writeOptimisticPantry(client.cache, optimisticPantry);
      if (homeId) addPantryToHomeCache(client.cache, homeId, optimisticPantry);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Create Pantry (optimistic)',
      });
    }

    const result = await createPantryMutation({
      variables: { input },
      context: { localFirst: true },
    });

    if (classifyCreateResult(result) !== 'rejected') {
      return { status: 'ok', rejectionMessage: null, result, id };
    }

    try {
      if (homeId) removeOptimisticPantry(client.cache, homeId, id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Pantry create',
      });
    }
    const payload = result.data?.createPantry;
    return {
      status: 'rejected',
      rejectionMessage:
        payload && 'message' in payload ? payload.message : null,
      result,
      id,
    };
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

    if (classifyCreateResult(result) !== 'rejected') {
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

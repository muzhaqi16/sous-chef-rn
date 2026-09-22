import {
  skipToken,
  useApolloClient,
  useQuery,
  useMutation,
} from '@apollo/client/react';
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
import { useToday } from '#features/pantry/hooks/useToday';
import {
  snapshotFields,
  writeEntityFields,
} from '#/apollo/utils/localFirstFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  removeOptimisticPantry,
  restorePantryToHomeCache,
} from '#features/pantry/utils/optimisticPantry';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { logger } from '#/utils/environment';
import { useTranslation } from '#/i18n';

/** Module-level so the try/catch does not bail the hook out of the compiler. */
function buildDeletePantryUpdater(homeId: string | null | undefined) {
  return function deletePantryUpdater(
    cache: ApolloCache,
    { data }: { data?: DeletePantryMutation | null },
    { variables }: { variables?: DeletePantryMutationVariables },
  ) {
    // Keyed off the VARIABLES: `DeletePantryPayload.pantry` is null when the
    // server converges a replay, exactly the case this has to handle.
    if (!appliedPayload(data) || !variables?.input.id || !homeId) return;
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
  const { t } = useTranslation();
  const today = useToday();
  const client = useApolloClient();
  // The create is `useCreatePantry`'s — one pantry create, wherever it is made.
  const { createPantry: createPantryWrite } = useCreatePantry();
  const hasValidPantryId = !!pantryId?.trim();

  const {
    data: pantryData,
    loading: loadingPantry,
    error: pantryError,
  } = useQuery(
    GetPantryDocument,
    hasValidPantryId && pantryId
      ? {
          variables: {
            id: pantryId,
            itemsFirst: 25,
            storageLocationsFirst: 15,
            today,
          },
        }
      : skipToken,
  );

  const pantry = pantryData?.pantry;

  const [updatePantry] = useMutation(UpdatePantryDocument, {
    // No `update`: Apollo merges the returned Pantry entity, and membership
    // lists are unchanged by an edit.
  });

  const [markAsDefault] = useMutation(MarkPantryAsDefaultDocument);

  const [deletePantryMutation] = useMutation(DeletePantryDocument, {
    update: buildDeletePantryUpdater(homeId),
  });

  /** False when the flag did not stick, so the caller can put its switch back. */
  const setDefault = async (id: string): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        markAsDefault({
          variables: { input: { id } },
          // Absolute flag on an existing row, so a replay lands the same state.
          context: { localFirst: true },
        }),
      {
        document: MarkPantryAsDefaultDocument,
        fallback: t('errors.saveSettingsFailed'),
      },
    );
    return settled.status !== 'failed';
  };

  /** The one pantry create, with its refusal shown to the user. */
  const createPantry = async (
    fields: Parameters<typeof createPantryWrite>[0],
  ) => {
    const outcome = await createPantryWrite(fields);
    if (outcome.failure) {
      alertService.alert(outcome.failure.title, outcome.failure.body);
    }
    return outcome;
  };

  /**
   * Absolute field write on an existing row, so a replay lands the same state —
   * safe to queue, and the rename shows immediately.
   */
  const savePantryFields = async (
    id: string,
    updates: { name: string; description: string },
  ): Promise<boolean> => {
    const entity = { __typename: 'Pantry', id };
    // Omits keys the read did not carry, so a refusal arriving before the
    // query resolves reverts nothing rather than blanking the real name.
    const previous = snapshotFields(pantry, updates);
    writeEntityFields(client.cache, entity, updates);

    const settled = await settleMutation(
      () =>
        updatePantry({
          variables: { input: { id, ...updates } },
          context: { localFirst: true },
        }),
      {
        document: UpdatePantryDocument,
        fallback: t('errors.saveSettingsFailed'),
        onFailed: () => writeEntityFields(client.cache, entity, previous),
      },
    );
    return settled.status !== 'failed';
  };

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

    const restore = () => {
      if (!homeId) return;
      try {
        restorePantryToHomeCache(client.cache, homeId, id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Pantry delete',
        });
      }
    };

    // Safe to queue: a delete converges server-side, and an id the server
    // never held leaves the row gone, which is what was asked for.
    const settled = await settleMutation(
      () =>
        deletePantryMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      {
        document: DeletePantryDocument,
        fallback: t('errors.deletePantryFailed'),
        removal: true,
        onFailed: restore,
      },
    );
    return settled.status === 'failed'
      ? { status: 'rejected', failure: settled.failure }
      : { status: 'ok' };
  };

  return {
    pantry,
    pantryItemCount: pantry?.itemsConnection.totalCount ?? 0,
    loadingPantry,
    pantryError,
    setDefault,
    createPantry,
    savePantryFields,
    deletePantry,
  };
}

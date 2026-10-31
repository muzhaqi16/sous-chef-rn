import {
  skipToken,
  useApolloClient,
  useQuery,
  useMutation,
} from '@apollo/client/react';
import {
  GetPantryDocument,
  UpdatePantryDocument,
  DeletePantryDocument,
  MarkPantryAsDefaultDocument,
} from '#features/pantry/graphql/pantry.generated';
import type { RemovePantryInputs } from '#features/pantry/offline/localWrites';
import {
  useCreatePantry,
  type PantryWriteOutcome,
} from '#features/pantry/hooks/useCreatePantry';
import { useToday } from '#hooks/app/useToday';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { readVersion } from '#/apollo/utils/entityWriteChain';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';

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
    refetch: refetchPantry,
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
    context: { localFirst: true },
  });

  const [markAsDefault] = useMutation(MarkPantryAsDefaultDocument, {
    // Absolute flag on an existing row, so a replay lands the same state.
    context: { localFirst: true },
  });

  const [deletePantryMutation] = useMutation(DeletePantryDocument, {
    context: { localFirst: true },
  });

  /**
   * False when the flag did not stick, so the caller can put its switch back.
   * In line with the pantry's saves: the server moves its version.
   */
  const setDefault = async (id: string): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'Pantry', id },
      fields: { isDefault: true },
      variables: { input: { id }, today: todayKey() },
      mutate: markAsDefault,
      settle: {
        document: MarkPantryAsDefaultDocument,
        fallback: t('errors.saveSettingsFailed'),
      },
    });
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
    // From the cache, not the query: another screen's read can hold the row
    // before this one answers.
    const version = readVersion(client.cache, entity);
    if (version === undefined) {
      alertService.alert(t('labels.error'), t('errors.saveSettingsFailed'));
      return false;
    }

    // A save made elsewhere since is refused, not overwritten.
    const settled = await sendFields(client.cache, {
      entity,
      fields: updates,
      variables: { input: { id, ...updates, version }, today: todayKey() },
      mutate: updatePantry,
      settle: {
        document: UpdatePantryDocument,
        fallback: t('errors.saveSettingsFailed'),
        onConflictRefresh: () => {
          void refetchPantry();
        },
      },
    });
    return settled.status !== 'failed';
  };

  /**
   * Safe to queue: a delete converges server-side, and an id the server never
   * held leaves the row gone, which is what was asked for.
   */
  const deletePantry = async (id: string): Promise<PantryWriteOutcome> => {
    const inputs: RemovePantryInputs = { homeId };
    const settled = await pendingWritesOf(client.cache).send(
      DeletePantryDocument,
      { input: { id } },
      write =>
        settleMutation(() => deletePantryMutation(write), {
          document: DeletePantryDocument,
          fallback: t('errors.deletePantryFailed'),
          removal: true,
        }),
      inputs,
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

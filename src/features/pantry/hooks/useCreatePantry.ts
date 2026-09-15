import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';
import {
  addPantryToHomeCache,
  buildOptimisticPantry,
  removeOptimisticPantry,
  writeOptimisticPantry,
} from '#features/pantry/utils/optimisticPantry';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import type { CreatePantryInput } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

/** A write's verdict. A refusal carries the localized copy the caller shows. */
export interface PantryWriteOutcome {
  status: 'ok' | 'rejected';
  failure?: SettledFailure;
}

/** A create also hands back the id it minted — the row's id, queued or not. */
export interface CreatePantryOutcome extends PantryWriteOutcome {
  id: string;
  /** The raw write, for a caller still reading refusals itself. */
  result: { data?: unknown; error?: unknown };
}

/**
 * The one pantry create. Local-first: the pantry is written complete under a
 * client-minted id before firing, so a home created offline has a pantry every
 * later write can name as its parent. Public because onboarding and the
 * settings screen both create one before any pantry screen mounts. Presents
 * nothing: each caller decides whether a refusal is worth a message.
 */
export function useCreatePantry() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [createPantry, { loading }] = useMutation(CreatePantryDocument, {
    update: (cache, { data }) => {
      const payload = appliedPayload(data);
      if (!payload) return;
      const newPantry = payload.pantry;
      if (!newPantry?.homeId) return;
      // Idempotent by pantry id: the pre-fire write already inserted this one,
      // so the server row confirms it rather than duplicating it.
      addPantryToHomeCache(cache, newPantry.homeId, newPantry);
    },
  });

  const create = async (
    fields: Omit<CreatePantryInput, 'id'>,
  ): Promise<CreatePantryOutcome> => {
    const id = generateEntityId();
    const input = { ...fields, id };
    const optimisticPantry = buildOptimisticPantry(id, input);
    try {
      writeOptimisticPantry(client.cache, optimisticPantry);
      addPantryToHomeCache(client.cache, input.homeId, optimisticPantry);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Create Pantry (optimistic)',
      });
    }

    const revert = () => {
      try {
        removeOptimisticPantry(client.cache, input.homeId, id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Pantry create',
        });
      }
    };

    let result: CreatePantryOutcome['result'] = {};
    const settled = await settleMutation(
      async () => {
        result = await createPantry({
          variables: { input },
          context: { localFirst: true },
        });
        return result;
      },
      {
        document: CreatePantryDocument,
        fallback: t('errors.createPantryFailed'),
        onFailed: revert,
        present: 'none',
      },
    );
    if (settled.status === 'failed') {
      return { status: 'rejected', failure: settled.failure, result, id };
    }
    return { status: 'ok', result, id };
  };

  return { createPantry: create, creating: loading };
}

/** The mutate function `useCreatePantry` returns, for callers that pass it on. */
export type CreatePantryFn = ReturnType<typeof useCreatePantry>['createPantry'];

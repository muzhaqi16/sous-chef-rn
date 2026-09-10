import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';
import {
  addPantryToHomeCache,
  buildOptimisticPantry,
  removeOptimisticPantry,
  writeOptimisticPantry,
} from '#features/pantry/utils/optimisticPantry';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';
import type { CreatePantryInput } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

/** A write's verdict, plus the refusal copy the caller reports. */
export interface PantryWriteOutcome {
  status: 'ok' | 'rejected';
  /** The payload's own message, when the server sent one. */
  rejectionMessage: string | null;
  /** Carried so the caller can resolve LOCALIZED copy from `errors.field.*`. */
  result: { data?: unknown; error?: unknown };
}

/** A create also hands back the id it minted — the row's id, queued or not. */
export interface CreatePantryOutcome extends PantryWriteOutcome {
  id: string;
}

/**
 * The one pantry create. Local-first: the pantry is written complete under a
 * client-minted id before firing, so a home created offline has a pantry every
 * later write can name as its parent. Public because onboarding and the
 * settings screen both create one before any pantry screen mounts.
 */
export function useCreatePantry() {
  const client = useApolloClient();
  const [createPantry, { loading }] = useMutation(CreatePantryDocument, {
    update: (cache, { data }) => {
      if (data?.createPantry?.__typename !== 'CreatePantryPayload') return;
      const newPantry = data.createPantry.pantry;
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

    const result = await createPantry({
      variables: { input },
      context: { localFirst: true },
    });

    if (classifyCreateResult(result) === 'rejected') {
      try {
        removeOptimisticPantry(client.cache, input.homeId, id);
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
    }
    return { status: 'ok', rejectionMessage: null, result, id };
  };

  return { createPantry: create, creating: loading };
}

/** The mutate function `useCreatePantry` returns, for callers that pass it on. */
export type CreatePantryFn = ReturnType<typeof useCreatePantry>['createPantry'];

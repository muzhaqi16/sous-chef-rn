import { useMutation } from '@apollo/client/react';
import {
  CreatePantryDocument,
  type CreatePantryMutation,
} from '#features/pantry/graphql/pantry.generated';
import type { CreatePantryInput } from '#/graphql/generated/schemaTypes';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/**
 * Create a pantry, writing it into the owning home's `pantries` field and its
 * connection. Public because onboarding creates the first pantry before any
 * pantry screen mounts; the cache write is here because the shape of a home's
 * pantry list is the pantry feature's to know.
 */
export function useCreatePantry() {
  const [createPantry, { loading }] = useMutation(CreatePantryDocument, {
    update: (cache, { data }) => {
      if (data?.createPantry?.__typename !== 'CreatePantryPayload') {
        return;
      }
      const newPantry = data.createPantry.pantry;
      if (!newPantry?.homeId) {
        return;
      }

      const homeCacheId = cache.identify({
        __typename: 'Home',
        id: newPantry.homeId,
      });
      if (!homeCacheId) {
        return;
      }

      cache.modify({
        id: homeCacheId,
        fields: {
          pantries(existingPantries = []) {
            return [
              ...existingPantries,
              {
                __typename: 'Pantry',
                id: newPantry.id,
                name: newPantry.name,
                isDefault: newPantry.isDefault,
              },
            ];
          },
          pantriesConnection(existingConnection = null) {
            if (!existingConnection) {
              return existingConnection;
            }
            const newEdge = {
              __typename: 'PantryEdge',
              cursor: newPantry.id,
              node: newPantry,
            };
            const edges = [...(existingConnection.edges || []), newEdge];
            return {
              ...existingConnection,
              edges,
              totalCount: existingConnection.totalCount ?? edges.length,
            };
          },
        },
      });
    },
  });

  return {
    createPantry: (
      input: CreatePantryInput,
    ): Promise<MutationOutcome<CreatePantryMutation>> =>
      createPantry({ variables: { input } }),
    creating: loading,
  };
}

/** The mutate function `useCreatePantry` returns, for callers that pass it on. */
export type CreatePantryFn = ReturnType<typeof useCreatePantry>['createPantry'];

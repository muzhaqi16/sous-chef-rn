/**
 * Local-first: the list is written to the cache PERMANENTLY before firing — an
 * `optimisticResponse` rolls back on the offline queue's null result. `input.id`
 * is the client-minted PK, so a queued replay converges on one row (a duplicate
 * surfaces as a ConflictError, which the queue drops).
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addOptimisticShoppingList,
  addShoppingListToQueryCache,
  buildOptimisticShoppingList,
  revertOptimisticShoppingList,
} from '#features/shoppingList/cache/list';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import type { CreateShoppingListInput } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

/** The created list — the server's when it answered, the local one when queued. */
export type CreateShoppingListOutcome =
  | { status: 'created'; shoppingList: { id: string; name: string } }
  | { status: 'failed'; body: string };

export function useCreateShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
  const user = useUser();

  const [mutate, { loading }] = useMutation(CreateShoppingListDocument, {
    update(cache, { data }) {
      const created = appliedPayload(data);
      if (created) addShoppingListToQueryCache(cache, created.shoppingList);
    },
  });

  const createShoppingList = async (
    input: CreateShoppingListInput,
  ): Promise<CreateShoppingListOutcome> => {
    const id = generateEntityId();

    // Materializing the ownership row needs an auth identity; without one the
    // create falls back to online-only (no create surface should hit this).
    const optimisticList = user
      ? buildOptimisticShoppingList(client.cache, id, input, user)
      : null;
    if (optimisticList) {
      try {
        addOptimisticShoppingList(client.cache, optimisticList);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Create Shopping List (optimistic)',
        });
      }
    }

    const settled = await settleMutation(
      () =>
        mutate({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      {
        document: CreateShoppingListDocument,
        fallback: fallbackErrorMessage,
        present: 'none',
        onFailed: () => {
          if (!optimisticList) return;
          try {
            revertOptimisticShoppingList(client.cache, id);
          } catch (cacheError) {
            errorService.reportError(cacheError, {
              operation: 'Revert failed Shopping List create',
            });
          }
        },
      },
    );

    if (settled.status === 'failed') {
      return {
        status: 'failed',
        body: settled.failure?.body ?? fallbackErrorMessage,
      };
    }

    const created = appliedPayload(settled.data)?.shoppingList;
    if (created) return { status: 'created', shoppingList: created };
    // Queued: the local list stands and the create replays under the same id.
    if (optimisticList) {
      return { status: 'created', shoppingList: optimisticList };
    }
    return { status: 'failed', body: fallbackErrorMessage };
  };

  return { createShoppingList, loading };
}

/**
 * useCreateShoppingList - Create list mutation (local-first).
 *
 * Generates the list's id client-side and writes the list into the cache
 * before firing the create, leaving it there. The list shows instantly in the
 * overview and stays if the create is queued offline or the API is
 * unreachable — the server stores `input.id` as the primary key and the queue
 * replays the create keyed by that same id, so they converge on one row (a
 * duplicate replay surfaces as a ConflictError, which the queue drops). An
 * `optimisticResponse` can't be used here: Apollo would roll it back the
 * moment the request is queued (null result).
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addOptimisticShoppingList,
  addShoppingListToQueryCache,
  buildOptimisticShoppingList,
  reconcileShoppingListCreate,
  revertOptimisticShoppingList,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { unwrapPayload } from '#/utils/errors/mutationPayload';
import { GraphQLNetworkError } from '#/utils/errors/graphqlErrors';
import { generateEntityId } from '#/utils/generateEntityId';
import { useWrite } from '#/apollo/write/useWrite';
import { ROOT_PARENT } from '#/apollo/write/writeIntent';
import { useUser } from '#store/useAppStore';
import type { CreateShoppingListInput } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

export function useCreateShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
  const { describe } = useWrite();
  const user = useUser();

  const [mutate, { loading }] = useMutation(CreateShoppingListDocument, {
    update(cache, { data }) {
      if (
        data?.createShoppingList?.__typename === 'CreateShoppingListPayload'
      ) {
        addShoppingListToQueryCache(
          cache,
          data.createShoppingList.shoppingList,
        );
      }
    },
  });

  const createShoppingList = async (input: CreateShoppingListInput) => {
    // Local-first: mint the permanent cuid id (the row's real PK).
    const id = generateEntityId();

    // Write the list into the cache (full entity + overview edge + empty
    // itemsConnection variants) before firing, so it shows immediately and
    // stays if the create is queued offline. Skipped when no auth identity is
    // available to materialize the ownership row (shouldn't happen on any
    // create surface) — the legacy online-only behavior applies then.
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

    // Records the create so the QUEUE can undo it: a replay refused after a
    // restart used to be a blind evict, which left the new list's edge dangling
    // in the overview. The overview is a ROOT-QUERY connection, which is why
    // `parent` is the root here rather than an entity.
    //
    // The builder above still owns the local write, and the synchronous failure
    // path below still uses `revertOptimisticShoppingList` — it undoes more
    // than the entity and its overview edge (the empty `itemsConnection`
    // variants, the ownership row), and none of that is expressible as a
    // reindex.
    const { context } = describe({
      target: { __typename: 'ShoppingList', id },
      lifecycle: 'create',
      patch: {},
      reindex: {
        parent: ROOT_PARENT,
        field: 'shoppingLists',
        decidableFilters: [],
        after: {},
        before: {},
      },
      convergence: 'absolute',
    });

    let result;
    try {
      result = await mutate({
        variables: { input: { ...input, id } },
        context,
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create Shopping List error:',
      });
    }

    if (!result) {
      // mutate() itself threw (non-queueable transport failure) — drop the
      // optimistic list and surface the standard failure to the caller.
      if (optimisticList) {
        try {
          revertOptimisticShoppingList(client.cache, id);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert failed Shopping List create',
          });
        }
      }
      throw new GraphQLNetworkError(fallbackErrorMessage);
    }

    const reconciled = optimisticList
      ? reconcileShoppingListCreate(client.cache, id, result)
      : 'reverted';
    const payload = result.data?.createShoppingList;

    if (!optimisticList || reconciled === 'reverted' || payload != null) {
      // Real response: unwrap the success payload, or throw the precise
      // domain/network error for the caller's toast.
      const success = unwrapPayload(
        payload,
        'CreateShoppingListPayload',
        fallbackErrorMessage,
      );
      return success.shoppingList;
    }

    // Queued (offline / API down): the optimistic list stays in cache and the
    // create replays keyed by the same id — succeed with the local entity.
    return optimisticList;
  };

  return { createShoppingList, loading };
}

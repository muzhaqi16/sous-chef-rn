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
import {
  executeCacheUpdate,
  executeMutation,
  unwrapPayload,
} from '#/utils/compilerSafeWrappers';
import { GraphQLNetworkError } from '#/utils/errors/graphqlErrors';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import type { CreateShoppingListInput } from '#/graphql/generated/schemaTypes';

export function useCreateShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
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
      executeCacheUpdate(
        () => addOptimisticShoppingList(client.cache, optimisticList),
        'Create Shopping List (optimistic)',
      );
    }

    const result = await executeMutation(
      () =>
        mutate({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      'Create Shopping List error:',
    );

    if (!result) {
      // mutate() itself threw (non-queueable transport failure) — drop the
      // optimistic list and surface the standard failure to the caller.
      if (optimisticList) {
        executeCacheUpdate(
          () => revertOptimisticShoppingList(client.cache, id),
          'Revert failed Shopping List create',
        );
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

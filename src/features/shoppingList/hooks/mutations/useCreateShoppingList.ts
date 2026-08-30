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
  reconcileShoppingListCreate,
  revertOptimisticShoppingList,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { unwrapPayload } from '#/utils/errors/mutationPayload';
import { GraphQLNetworkError } from '#/utils/errors/graphqlErrors';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';
import type { CreateShoppingListInput } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

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

    let result;
    try {
      result = await mutate({
        variables: { input: { ...input, id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create Shopping List error:',
      });
    }

    if (!result) {
      // mutate() itself threw (non-queueable transport failure) — drop the
      // optimistic list and surface the failure to the caller.
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
      // Success unwraps the payload; a refusal throws the precise domain error.
      const success = unwrapPayload(
        payload,
        'CreateShoppingListPayload',
        fallbackErrorMessage,
      );
      return success.shoppingList;
    }

    // Queued: the optimistic list stands and the create replays under the same id.
    return optimisticList;
  };

  return { createShoppingList, loading };
}

/**
 * useUpdateShoppingList - Rename / settings update for a shopping list
 * (local-first).
 *
 * The edit goes through the declared write path: the change is described once
 * as a `WriteIntent`, the kit writes it to the cache PERMANENTLY before firing
 * (an `optimisticResponse` would be torn down the moment the offline queue
 * completes the request with a null result), derives the patch that undoes it,
 * and carries the intent to the queue — so a withdrawal after a restart
 * restores the preceding values instead of evicting the list.
 *
 * A real rejection reverts and throws the precise domain error for the caller's
 * localized toast.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseUpdateShoppingList_ListFragmentDoc,
  type UseUpdateShoppingList_ListFragment,
} from './useUpdateShoppingList.generated';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { useWrite } from '#/apollo/write/useWrite';
import { unwrapPayload } from '#/utils/errors/mutationPayload';
import { GraphQLNetworkError } from '#/utils/errors/graphqlErrors';
import { generateEntityId } from '#/utils/generateEntityId';
import type { ListStatus } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

interface ShoppingListSettingsUpdate {
  name?: string;
  isDefault?: boolean;
  // Absolute status set — drives archive via updateShoppingList(status: ARCHIVED).
  status?: ListStatus;
}

export function useUpdateShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
  const { apply } = useWrite();
  const [mutate, { loading }] = useMutation(UpdateShoppingListDocument);

  const updateShoppingList = async (
    id: string,
    updates: ShoppingListSettingsUpdate,
  ) => {
    const cacheId = client.cache.identify({ __typename: 'ShoppingList', id });
    // Read for two things the kit cannot supply: the version the server checks
    // against (`UpdateShoppingListInput.version` is required — an update sent
    // without one reports success while overwriting a concurrent edit), and the
    // is-this-row-cached guard. The read stays on the full settings fragment so
    // the guard keeps refusing exactly what it refused before; nothing else
    // here is snapshotted, because the intent owns the undo.
    const cached = cacheId
      ? client.cache.readFragment<UseUpdateShoppingList_ListFragment>({
          id: cacheId,
          fragment: UseUpdateShoppingList_ListFragmentDoc,
          fragmentName: 'useUpdateShoppingList_list',
        })
      : null;

    if (!cached) {
      throw new GraphQLNetworkError(fallbackErrorMessage);
    }

    const { context, revert } = apply({
      target: { __typename: 'ShoppingList', id },
      patch: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.isDefault !== undefined && {
          isDefault: updates.isDefault,
        }),
        ...(updates.status !== undefined && { status: updates.status }),
        updatedAt: new Date().toISOString(),
      },
      // Every field here carries the final value the person chose, so a version
      // conflict on replay is resolved by re-sending against a fresh version
      // rather than by discarding the edit.
      convergence: 'absolute',
    });

    // Built above the try: anything conditional inside a try body bails the
    // React Compiler out of the whole function, and this project's bailout
    // baseline is empty.
    const input = {
      id,
      ...updates,
      version: cached.version,
      // Claimed by the server BEFORE its version check, so a queued replay
      // converges instead of being refused on the stale version it necessarily
      // carries.
      idempotencyKey: generateEntityId(),
    };

    let result;
    try {
      result = await mutate({ variables: { input }, context });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Update Shopping List error:',
      });
    }

    if (!result) {
      // mutate() itself threw (non-queueable transport failure).
      revert();
      throw new GraphQLNetworkError(fallbackErrorMessage);
    }

    const outcome = classifyCreateResult(result);
    if (outcome === 'queued') {
      // Offline / API down: the permanent write stands and the update replays
      // keyed by the list id — report success with the local state.
      return null;
    }
    if (outcome === 'rejected') {
      // Refused on the spot — and a refusal that never entered the queue is one
      // the queue's withdrawal will never see, so undo it here. This covers a
      // surfaced `result.error` too: with no payload object, that classifies
      // as a refusal.
      revert();
    }
    // Success returns the server entity; rejection throws the domain error.
    const success = unwrapPayload(
      result.data?.updateShoppingList,
      'UpdateShoppingListPayload',
      fallbackErrorMessage,
    );
    return success.shoppingList;
  };

  return { updateShoppingList, loading };
}

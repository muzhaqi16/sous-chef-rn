/**
 * useUpdateShoppingList - Rename / settings update for a shopping list
 * (local-first).
 *
 * Writes the changed fields to the cache PERMANENTLY before firing, so the
 * update survives an offline / API-down queue (the replay re-sends the
 * original mutation — absolute field sets keyed by the list id, idempotent).
 * A real rejection restores the pre-edit snapshot and throws the precise
 * domain error for the caller's toast.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseUpdateShoppingList_ListFragmentDoc,
  type UseUpdateShoppingList_ListFragment,
} from './useUpdateShoppingList.generated';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  executeCacheUpdate,
  executeMutation,
  unwrapPayload,
} from '#/utils/compilerSafeWrappers';
import { GraphQLNetworkError } from '#/utils/errors/graphqlErrors';
import type { ListStatus } from '#/graphql/generated/schemaTypes';

interface ShoppingListSettingsUpdate {
  name?: string;
  isDefault?: boolean;
  // Absolute status set — drives archive via updateShoppingList(status: ARCHIVED).
  status?: ListStatus;
}

export function useUpdateShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
  const [mutate, { loading }] = useMutation(UpdateShoppingListDocument);

  const updateShoppingList = async (
    id: string,
    updates: ShoppingListSettingsUpdate,
  ) => {
    const cacheId = client.cache.identify({ __typename: 'ShoppingList', id });
    const snapshot = cacheId
      ? client.cache.readFragment<UseUpdateShoppingList_ListFragment>({
          id: cacheId,
          fragment: UseUpdateShoppingList_ListFragmentDoc,
          fragmentName: 'useUpdateShoppingList_list',
        })
      : null;

    const writeList = (data: UseUpdateShoppingList_ListFragment) =>
      client.cache.writeFragment({
        id: cacheId,
        fragment: UseUpdateShoppingList_ListFragmentDoc,
        fragmentName: 'useUpdateShoppingList_list',
        data,
      });

    // Permanent write BEFORE firing — survives an offline/API-down queue
    // (where no response ever arrives to materialize the change).
    if (snapshot) {
      executeCacheUpdate(
        () =>
          writeList({
            ...snapshot,
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.isDefault !== undefined && {
              isDefault: updates.isDefault,
            }),
            ...(updates.status !== undefined && { status: updates.status }),
            updatedAt: new Date().toISOString(),
          }),
        'Update Shopping List (optimistic)',
      );
    }

    const revert = () => {
      if (snapshot) {
        executeCacheUpdate(
          () => writeList(snapshot),
          'Revert rejected Shopping List update',
        );
      }
    };

    const result = await executeMutation(
      () =>
        mutate({
          variables: { input: { id, ...updates } },
          context: { localFirst: true },
        }),
      'Update Shopping List error:',
    );

    if (!result) {
      // mutate() itself threw (non-queueable transport failure).
      revert();
      throw new GraphQLNetworkError(fallbackErrorMessage);
    }

    const outcome = classifyCreateResult(
      result,
      'updateShoppingList',
      'UpdateShoppingListPayload',
    );
    if (outcome === 'queued') {
      // Offline / API down: the permanent write stands and the update replays
      // keyed by the list id — report success with the local state.
      return null;
    }
    if (outcome === 'rejected') {
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

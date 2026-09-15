/**
 * Local-first: the changed fields are written to the cache PERMANENTLY before
 * firing, so the update survives an offline queue — the replay re-sends absolute
 * field sets keyed by the list id, idempotent. A rejection restores the pre-edit
 * snapshot and throws, leaving the one message to the caller's toast.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseUpdateShoppingList_ListFragmentDoc,
  type UseUpdateShoppingList_ListFragment,
} from './useUpdateShoppingList.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { GraphQLNetworkError } from '#/utils/errors/graphqlErrors';
import { appliedPayload } from '#/utils/errors/mutationPayload';
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
  const [mutate] = useMutation(UpdateShoppingListDocument);

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

    if (snapshot) {
      // Built before the try — a conditional spread inside a try body bails the
      // React Compiler out of this hook.
      const optimisticList = {
        ...snapshot,
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.isDefault !== undefined && {
          isDefault: updates.isDefault,
        }),
        ...(updates.status !== undefined && { status: updates.status }),
        updatedAt: new Date().toISOString(),
      };
      try {
        writeList(optimisticList);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Update Shopping List (optimistic)',
        });
      }
    }

    const revert = () => {
      if (snapshot) {
        try {
          writeList(snapshot);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected Shopping List update',
          });
        }
      }
    };

    // The server requires the version: an update sent without one reports success
    // while overwriting a concurrent edit. The snapshot's is the one to send.
    if (!snapshot) {
      throw new GraphQLNetworkError(fallbackErrorMessage);
    }

    const settled = await settleMutation(
      () =>
        mutate({
          variables: { input: { id, ...updates, version: snapshot.version } },
          context: { localFirst: true },
        }),
      {
        document: UpdateShoppingListDocument,
        fallback: fallbackErrorMessage,
        onFailed: revert,
        present: 'none',
      },
    );
    if (settled.failure) throw new GraphQLNetworkError(settled.failure.body);

    // Queued (offline / API down): the permanent write stands and the update
    // replays keyed by the list id; there is no server entity to return.
    return appliedPayload(settled.data)?.shoppingList ?? null;
  };

  return { updateShoppingList };
}

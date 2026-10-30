/**
 * Local-first: the changed fields are cached PERMANENTLY before firing, and a
 * replay re-sends absolute sets keyed by the list id. A rejection restores the
 * pre-edit snapshot and throws, leaving the one message to the caller's toast.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  GetShoppingListItemsFilteredDocument,
  UpdateShoppingListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ListStoreSavingsDocument } from '#features/shoppingList/hooks/useListStoreComparison.generated';
import {
  UseUpdateShoppingList_ListFragmentDoc,
  type UseUpdateShoppingList_ListFragment,
} from './useUpdateShoppingList.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { GraphQLNetworkError } from '#/utils/errors/graphqlErrors';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import type {
  ListStatus,
  ShoppingListPlanningInput,
} from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

interface ShoppingListSettingsUpdate {
  name?: string;
  isDefault?: boolean;
  // Absolute status set — drives archive via updateShoppingList(status: ARCHIVED).
  status?: ListStatus;
  // Rides on the same write as the rename: every versioned write bumps the
  // version, so a second write would need the first one's answer first.
  planning?: Pick<ShoppingListPlanningInput, 'budgetAmount' | 'currency'>;
  // The trip's store, where a ticked line's price is recorded; null clears it.
  // Sent as planning.targetStoreId; the name is for the local write.
  targetStore?: { id: string; name: string } | null;
}

export function useUpdateShoppingList(fallbackErrorMessage: string) {
  const client = useApolloClient();
  const [mutate] = useMutation(UpdateShoppingListDocument, {
    context: { localFirst: true },
    update(cache, { data }, { variables }) {
      const savings = appliedPayload(data)?.storeSavings;
      if (!savings || !variables) return;
      cache.writeQuery({
        query: ListStoreSavingsDocument,
        variables: { input: { listId: variables.input.id } },
        data: { __typename: 'Query', shoppingListStoreSavings: savings },
      });
    },
  });

  /**
   * `restateSavings`: the savings are on screen, and a change of store
   * restates them in the same answer.
   */
  const updateShoppingList = async (
    id: string,
    updates: ShoppingListSettingsUpdate,
    { restateSavings = false }: { restateSavings?: boolean } = {},
  ) => {
    const { targetStore, ...fields } = updates;
    const planning =
      targetStore === undefined
        ? fields.planning
        : { ...fields.planning, targetStoreId: targetStore?.id ?? null };
    const localStore:
      | UseUpdateShoppingList_ListFragment['targetStore']
      | undefined =
      targetStore === undefined
        ? undefined
        : targetStore && { __typename: 'Store', ...targetStore };
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
        ...(updates.planning?.budgetAmount !== undefined && {
          budgetAmount: updates.planning.budgetAmount,
        }),
        ...(updates.planning?.currency !== undefined && {
          currency: updates.planning.currency,
        }),
        ...(localStore !== undefined && { targetStore: localStore }),
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

    const withSavings = targetStore !== undefined && restateSavings;
    const settled = await settleMutation(
      () =>
        mutate({
          variables: {
            input: {
              id,
              ...fields,
              ...(planning !== undefined && { planning }),
              version: snapshot.version,
            },
            ...(withSavings && { withSavings }),
          },
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
    const updated = appliedPayload(settled.data)?.shoppingList ?? null;
    // The list's store prices every line's suggestion, which the list the
    // response carries does not restate.
    if (updated && targetStore !== undefined) {
      void client.refetchQueries({
        include: [GetShoppingListItemsFilteredDocument],
      });
    }
    return updated;
  };

  return { updateShoppingList };
}

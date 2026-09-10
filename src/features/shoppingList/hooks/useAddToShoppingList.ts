import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  AddItemToShoppingListDocument,
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  buildAddItemsReconcileUpdate,
  revertOptimisticShoppingListItem,
} from '#features/shoppingList/cache/items';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

/** Whether the row survived. The caller owns the toast and the animation. */
export type AddItemOutcome = 'kept' | 'reverted';

interface NewItem {
  itemId: string;
  itemName: string;
  unitId?: string;
}

interface UseAddToShoppingListArgs {
  shoppingListId: string | undefined;
  suggestionsLimit: number;
}

/**
 * Every cache write the add-to-list sheet performs. The row is written before
 * the mutation fires and left there, so it survives being queued offline. An
 * `optimisticResponse` cannot: Apollo tears it down the moment the queue
 * completes the request with a null result.
 */
export function useAddToShoppingList({
  shoppingListId,
  suggestionsLimit,
}: UseAddToShoppingListArgs) {
  const client = useApolloClient();

  const [addItemMutation, { loading: adding }] = useMutation(
    AddItemToShoppingListDocument,
    {
      update: buildAddItemsReconcileUpdate({
        listId: shoppingListId,
        wrap: { message: 'Cache update failed for addItem:' },
      }),
    },
  );

  /** Drop a suggestion from every list it appears in, synchronously. */
  const removeSuggestion = (itemId: string) => {
    if (!shoppingListId) return;
    client.cache.updateQuery<GetShoppingListSuggestionsQuery>(
      {
        query: GetShoppingListSuggestionsDocument,
        variables: { id: shoppingListId, limit: suggestionsLimit },
      },
      data => {
        if (!data?.shoppingList) return data;
        const list = data.shoppingList;
        const without = <T extends { itemId: string }>(entries: readonly T[]) =>
          entries.filter(s => s.itemId !== itemId);
        return {
          ...data,
          shoppingList: {
            ...list,
            recentlyDeleted: without(list.recentlyDeleted),
            frequentlyAdded: without(list.frequentlyAdded),
            popular: without(list.popular),
          },
        };
      },
    );
  };

  const addItem = async ({
    itemId,
    itemName,
    unitId,
  }: NewItem): Promise<AddItemOutcome> => {
    if (!shoppingListId) return 'reverted';
    const id = generateEntityId();

    try {
      addOptimisticShoppingListItem(
        client.cache,
        shoppingListId,
        createOptimisticShoppingListItem(id, {
          shoppingListId,
          itemName,
          itemId,
          unitId,
        }),
      );
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Shopping List Item (optimistic)',
      });
    }

    // Built outside the try: a ternary is a value block, and one inside a try
    // body bails the React Compiler out of the whole function.
    const variables = {
      input: {
        shoppingListId,
        items: [
          {
            id,
            item: { itemId },
            quantity: null,
            unit: unitId ? { unitId } : undefined,
          },
        ],
      },
    };

    let result;
    let threw = false;
    try {
      result = await addItemMutation({
        variables,
        context: { localFirst: true },
      });
    } catch {
      threw = true;
    }

    if (threw || !result) {
      revertOptimisticShoppingListItem(client.cache, shoppingListId, id);
      return 'reverted';
    }
    // A queued create (offline / API down) resolves with no data and no error —
    // keep the row. A real rejection lands here too under `errorPolicy: 'all'`,
    // so the reconciler classifies the result rather than relying on a throw.
    return reconcileShoppingCreate(client.cache, shoppingListId, id, result);
  };

  return { addItem, removeSuggestion, adding };
}

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  AddItemToShoppingListDocument,
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { buildAddItemsReconcileUpdate } from '#features/shoppingList/cache/items';
import { createShoppingListRow } from '#features/shoppingList/cache/createShoppingListRow';
import { useTranslation } from '#/i18n';

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
  const { t } = useTranslation();

  const [addItemMutation, { loading: adding }] = useMutation(
    AddItemToShoppingListDocument,
    {
      update: buildAddItemsReconcileUpdate({
        listId: shoppingListId,
        wrap: { operation: 'Cache update failed for addItem:' },
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
        const sections = list.suggestions;
        const without = <T extends { itemId: string }>(entries: readonly T[]) =>
          entries.filter(s => s.itemId !== itemId);
        return {
          ...data,
          shoppingList: {
            ...list,
            suggestions: {
              ...sections,
              recentlyDeleted: without(sections.recentlyDeleted),
              frequentlyAdded: without(sections.frequentlyAdded),
              popular: without(sections.popular),
            },
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
    const { outcome } = await createShoppingListRow(client.cache, {
      listId: shoppingListId,
      row: { itemName, itemId, unitId },
      line: {
        item: { itemId },
        quantity: null,
        unit: unitId ? { id: unitId } : undefined,
      },
      send: addItemMutation,
      document: AddItemToShoppingListDocument,
      fallback: t('errors.addItemFailed'),
    });
    return outcome;
  };

  return { addItem, removeSuggestion, adding };
}

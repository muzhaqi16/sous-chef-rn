import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  AddItemToShoppingListDocument,
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { buildAddItemsReconcileUpdate } from '#features/shoppingList/cache/items';
import { createShoppingListRow } from '#features/shoppingList/cache/createShoppingListRow';
import { useTranslation } from '#/i18n';
import {
  putSuggestionBack,
  takeSuggestion,
  type SuggestionRemoval,
} from '#domain/suggestionRemoval';

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

type Sections = NonNullable<
  GetShoppingListSuggestionsQuery['shoppingList']
>['suggestions'];

/** What `removeSuggestion` took from each section, for `restoreSuggestion`. */
interface ShoppingSuggestionRemoval {
  readonly shoppingListId: string;
  readonly recentlyDeleted: SuggestionRemoval<
    Sections['recentlyDeleted'][number]
  > | null;
  readonly frequentlyAdded: SuggestionRemoval<
    Sections['frequentlyAdded'][number]
  > | null;
  readonly popular: SuggestionRemoval<Sections['popular'][number]> | null;
}

/**
 * Every cache write the add-to-list sheet performs. The row is written before
 * the mutation fires and left, so it survives an offline queue, which an
 * `optimisticResponse` cannot: Apollo drops it on the queue's null result.
 */
export function useAddToShoppingList({
  shoppingListId,
  suggestionsLimit,
}: UseAddToShoppingListArgs) {
  const client = useApolloClient();
  const { t } = useTranslation();

  const [addItemMutation] = useMutation(AddItemToShoppingListDocument, {
    update: buildAddItemsReconcileUpdate({
      listId: shoppingListId,
      wrap: { operation: 'Cache update failed for addItem:' },
    }),
  });

  const readSuggestions = (forList: string) => {
    const variables = { id: forList, limit: suggestionsLimit };
    const data = client.cache.readQuery<GetShoppingListSuggestionsQuery>({
      query: GetShoppingListSuggestionsDocument,
      variables,
      optimistic: true,
    });
    return { data, variables };
  };

  /**
   * Drops a suggestion from every list it appears in, synchronously, and
   * returns what it took so `restoreSuggestion` can put it back in place;
   * `null` when no list held it, as after a second tap.
   */
  const removeSuggestion = (
    itemId: string,
  ): ShoppingSuggestionRemoval | null => {
    if (!shoppingListId) return null;
    const { data, variables } = readSuggestions(shoppingListId);
    if (!data?.shoppingList) return null;
    const list = data.shoppingList;
    const sections = list.suggestions;
    const recentlyDeleted = takeSuggestion(sections.recentlyDeleted, itemId);
    const frequentlyAdded = takeSuggestion(sections.frequentlyAdded, itemId);
    const popular = takeSuggestion(sections.popular, itemId);
    const took = [recentlyDeleted, frequentlyAdded, popular].some(
      section => section.removal !== null,
    );
    if (!took) return null;
    client.cache.writeQuery<GetShoppingListSuggestionsQuery>({
      query: GetShoppingListSuggestionsDocument,
      variables,
      data: {
        ...data,
        shoppingList: {
          ...list,
          suggestions: {
            ...sections,
            recentlyDeleted: recentlyDeleted.list,
            frequentlyAdded: frequentlyAdded.list,
            popular: popular.list,
          },
        },
      },
    });
    return {
      shoppingListId,
      recentlyDeleted: recentlyDeleted.removal,
      frequentlyAdded: frequentlyAdded.removal,
      popular: popular.removal,
    };
  };

  /** Puts back what `removeSuggestion` took, each entry at its old place. */
  const restoreSuggestion = (removal: ShoppingSuggestionRemoval | null) => {
    if (!removal) return;
    const { data, variables } = readSuggestions(removal.shoppingListId);
    if (!data?.shoppingList) return;
    const list = data.shoppingList;
    const sections = list.suggestions;
    client.cache.writeQuery<GetShoppingListSuggestionsQuery>({
      query: GetShoppingListSuggestionsDocument,
      variables,
      data: {
        ...data,
        shoppingList: {
          ...list,
          suggestions: {
            ...sections,
            recentlyDeleted: putSuggestionBack(
              sections.recentlyDeleted,
              removal.recentlyDeleted,
            ),
            frequentlyAdded: putSuggestionBack(
              sections.frequentlyAdded,
              removal.frequentlyAdded,
            ),
            popular: putSuggestionBack(sections.popular, removal.popular),
          },
        },
      },
    });
  };

  const addItem = async ({
    itemId,
    itemName,
    unitId,
  }: NewItem): Promise<AddItemOutcome> => {
    if (!shoppingListId) return 'reverted';
    const { outcome } = await createShoppingListRow(client.cache, {
      listId: shoppingListId,
      row: { itemName, unitId },
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

  return { addItem, removeSuggestion, restoreSuggestion };
}

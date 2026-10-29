import { useApolloClient } from '@apollo/client/react';
import {
  GetPantryDocument,
  GetPantryItemSuggestionsDocument,
  type GetPantryQuery,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import { findCachedPantryItemDuplicate } from '#features/pantry/utils/pantryCacheReaders';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { usePantryRestock } from '#features/pantry/hooks/usePantryRestock';
import { extractNodes } from '#/utils/connectionUtils';
import {
  putSuggestionBack,
  takeSuggestion,
  type SuggestionRemoval,
} from '#domain/suggestionRemoval';

interface UseAddToPantryArgs {
  pantryId: string | undefined;
  suggestionsLimit: number;
}

type Sections = NonNullable<
  GetPantryItemSuggestionsQuery['pantry']
>['suggestions'];

/** What `removeSuggestion` took from each section, for `restoreSuggestion`. */
interface PantrySuggestionRemoval {
  readonly pantryId: string;
  readonly lowStock: SuggestionRemoval<Sections['lowStock'][number]> | null;
  readonly expiringSoon: SuggestionRemoval<
    Sections['expiringSoon'][number]
  > | null;
  readonly recentlyDeleted: SuggestionRemoval<
    Sections['recentlyDeleted'][number]
  > | null;
  readonly frequentlyAdded: SuggestionRemoval<
    Sections['frequentlyAdded'][number]
  > | null;
  readonly popular: SuggestionRemoval<Sections['popular'][number]> | null;
}

/**
 * Every cache write and mutation the add-to-pantry sheet performs; the sheet
 * keeps the toast and the in-flight set. The create is `usePantryIntake`, so
 * the sheet's two entry points cannot drift.
 */
export function useAddToPantry({
  pantryId,
  suggestionsLimit,
}: UseAddToPantryArgs) {
  const client = useApolloClient();

  const intake = usePantryIntake(pantryId);

  const { restock } = usePantryRestock(pantryId);

  const readSuggestions = (forPantry: string) => {
    const variables = { pantryId: forPantry, limit: suggestionsLimit };
    const data = client.cache.readQuery<GetPantryItemSuggestionsQuery>({
      query: GetPantryItemSuggestionsDocument,
      variables,
    });
    return { data, variables };
  };

  /**
   * Drops a suggestion from every list it appears in, synchronously, and
   * returns what it took so `restoreSuggestion` can put it back in place;
   * `null` when no list held it, as after a second tap.
   */
  const removeSuggestion = (itemId: string): PantrySuggestionRemoval | null => {
    if (!pantryId) return null;
    const { data, variables } = readSuggestions(pantryId);
    if (!data?.pantry) return null;
    const { pantry } = data;
    const sections = pantry.suggestions;
    const lowStock = takeSuggestion(sections.lowStock, itemId);
    const expiringSoon = takeSuggestion(sections.expiringSoon, itemId);
    const recentlyDeleted = takeSuggestion(sections.recentlyDeleted, itemId);
    const frequentlyAdded = takeSuggestion(sections.frequentlyAdded, itemId);
    const popular = takeSuggestion(sections.popular, itemId);
    const took = [
      lowStock,
      expiringSoon,
      recentlyDeleted,
      frequentlyAdded,
      popular,
    ].some(section => section.removal !== null);
    if (!took) return null;
    client.cache.writeQuery<GetPantryItemSuggestionsQuery>({
      query: GetPantryItemSuggestionsDocument,
      variables,
      data: {
        ...data,
        pantry: {
          ...pantry,
          suggestions: {
            ...sections,
            lowStock: lowStock.list,
            expiringSoon: expiringSoon.list,
            recentlyDeleted: recentlyDeleted.list,
            frequentlyAdded: frequentlyAdded.list,
            popular: popular.list,
          },
        },
      },
    });
    return {
      pantryId,
      lowStock: lowStock.removal,
      expiringSoon: expiringSoon.removal,
      recentlyDeleted: recentlyDeleted.removal,
      frequentlyAdded: frequentlyAdded.removal,
      popular: popular.removal,
    };
  };

  /** Puts back what `removeSuggestion` took, each entry at its old place. */
  const restoreSuggestion = (removal: PantrySuggestionRemoval | null) => {
    if (!removal) return;
    const { data, variables } = readSuggestions(removal.pantryId);
    if (!data?.pantry) return;
    const { pantry } = data;
    const sections = pantry.suggestions;
    client.cache.writeQuery<GetPantryItemSuggestionsQuery>({
      query: GetPantryItemSuggestionsDocument,
      variables,
      data: {
        ...data,
        pantry: {
          ...pantry,
          suggestions: {
            ...sections,
            lowStock: putSuggestionBack(sections.lowStock, removal.lowStock),
            expiringSoon: putSuggestionBack(
              sections.expiringSoon,
              removal.expiringSoon,
            ),
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

  /** The pantry's storage locations, read once from cache with no watcher. */
  const readStorageLocations = () => {
    const cached = client.readQuery<GetPantryQuery>({
      query: GetPantryDocument,
      variables: { id: pantryId ?? '' },
    });
    return extractNodes(cached?.pantry?.storageLocationsConnection);
  };

  /**
   * Does this pantry already stock the item in the unit the add would create,
   * as far as the cache knows? An unknown unit is the server's to resolve.
   */
  const findCachedDuplicate = (
    itemId: string,
    unitId: string | null | undefined,
  ) =>
    pantryId && unitId
      ? findCachedPantryItemDuplicate(client.cache, pantryId, {
          itemId,
          unitId,
        })
      : null;

  /** Restock the row by one of the product, as its stack counts it. */
  const restockItem = (
    pantryItemId: string,
    item: { id: string; name: string },
  ) =>
    restock(pantryItemId, {
      bought: { count: 1, item: { source: { id: item.id }, name: item.name } },
      present: 'none',
    });

  /** The sheet adds a catalog item as-is: the server fills quantity and unit. */
  const addItem = (itemId: string, itemName: string) =>
    intake.addItem(itemName, { item: { id: itemId } });

  return {
    addItem,
    restockItem,
    removeSuggestion,
    restoreSuggestion,
    readStorageLocations,
    findCachedDuplicate,
  };
}

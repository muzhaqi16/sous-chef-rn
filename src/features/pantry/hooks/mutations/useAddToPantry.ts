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

interface UseAddToPantryArgs {
  pantryId: string | undefined;
  suggestionsLimit: number;
}

/**
 * Every cache write and mutation the add-to-pantry sheet performs. What the
 * sheet keeps is the toast, the exit animation and the in-flight set; the
 * create itself is `usePantryIntake`, so the sheet's two entry points cannot
 * drift apart.
 */
export function useAddToPantry({
  pantryId,
  suggestionsLimit,
}: UseAddToPantryArgs) {
  const client = useApolloClient();

  const intake = usePantryIntake(pantryId);

  const { restock } = usePantryRestock(pantryId);

  /** Drop a suggestion from every list it appears in, synchronously. */
  const removeSuggestion = (itemId: string) => {
    if (!pantryId) return;
    client.cache.updateQuery<GetPantryItemSuggestionsQuery>(
      {
        query: GetPantryItemSuggestionsDocument,
        variables: { pantryId, limit: suggestionsLimit },
      },
      data => {
        if (!data?.pantry) return data;
        const { pantry } = data;
        const sections = pantry.suggestions;
        const without = <T extends { itemId: string }>(list: readonly T[]) =>
          list.filter(s => s.itemId !== itemId);
        return {
          ...data,
          pantry: {
            ...pantry,
            suggestions: {
              ...sections,
              lowStock: without(sections.lowStock),
              expiringSoon: without(sections.expiringSoon),
              recentlyDeleted: without(sections.recentlyDeleted),
              frequentlyAdded: without(sections.frequentlyAdded),
              popular: without(sections.popular),
            },
          },
        };
      },
    );
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
  const restockItem = (pantryItemId: string) =>
    restock(pantryItemId, { bought: { count: 1 }, present: 'none' });

  /** The sheet adds a catalog item as-is: the server fills quantity and unit. */
  const addItem = (itemId: string, itemName: string) =>
    intake.addItem(itemName, { item: { id: itemId } });

  return {
    addItem,
    restockItem,
    removeSuggestion,
    readStorageLocations,
    findCachedDuplicate,
  };
}

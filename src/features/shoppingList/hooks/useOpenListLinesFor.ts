import { skipToken, useQuery } from '@apollo/client/react';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useDataState, type DataState } from '#hooks/data/useDataState';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';

// A list holds an item on one line at most, so a receipt's items fit one page.
const PAGE = 100;
// The API refuses more items than this in one lookup (`itemIds`).
const MAX_ITEMS = 100;

/**
 * The list's open lines naming one of `itemIds`, asked for those items alone,
 * so a long list is never paged through to find them. `spareItemIds` are asked
 * for too while the API's limit has room, and never in place of one of `itemIds`.
 */
export function useOpenListLinesFor(
  listId: string | undefined,
  itemIds: readonly string[],
  spareItemIds: readonly string[] = [],
): {
  lines: ShoppingListItemNode[];
  loading: boolean;
  /** Some lines naming `itemIds` went unread: past a page, or past the API's item limit. */
  incomplete: boolean;
  /** Whether the latest lookup was answered: lines already shown stay either way. */
  state: DataState;
  retry: () => void;
} {
  const distinct = [...new Set(itemIds)].sort();
  const asked = new Set(distinct.slice(0, MAX_ITEMS));
  for (const itemId of [...spareItemIds].sort()) {
    if (asked.size >= MAX_ITEMS) break;
    asked.add(itemId);
  }
  // Sorted as one: the same items are the same lookup however they are split.
  const ids = [...asked].sort();
  const asking = !!listId && ids.length > 0;
  const { data, loading, error, refetch } = useQuery(
    GetShoppingListItemsFilteredDocument,
    asking
      ? {
          variables: {
            id: listId,
            first: PAGE,
            isPurchased: false,
            itemIds: ids,
          },
          // A lookup for one receipt: nothing to resync.
          refetchOn: false,
        }
      : skipToken,
  );
  // A new set of items keeps the last answer for the list until it lands, so
  // the links already shown hold.
  const shown = usePreservedQueryData(data, undefined, listId ?? '');
  const connection = shown?.shoppingList?.itemsConnection;
  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: false,
    skipped: !asking,
  });
  return {
    lines: extractNodes(connection),
    loading: loading && !shown,
    incomplete:
      distinct.length > MAX_ITEMS || !!connection?.pageInfo.hasNextPage,
    state,
    retry: () => {
      void refetch();
    },
  };
}

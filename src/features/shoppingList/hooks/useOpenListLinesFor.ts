import { skipToken, useQuery } from '@apollo/client/react';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';

// A list holds an item on one line at most, so a receipt's items fit one page.
const PAGE = 100;

/**
 * The list's open lines naming one of `itemIds`, asked for those items alone,
 * so a long list is never paged through to find them.
 */
export function useOpenListLinesFor(
  listId: string | undefined,
  itemIds: readonly string[],
): {
  lines: ShoppingListItemNode[];
  loading: boolean;
  /** More lines name these items than one page holds: some went unread. */
  incomplete: boolean;
} {
  const ids = [...new Set(itemIds)].sort();
  const { data, loading } = useQuery(
    GetShoppingListItemsFilteredDocument,
    listId && ids.length > 0
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
  return {
    lines: extractNodes(connection),
    loading: loading && !shown,
    incomplete: !!connection?.pageInfo.hasNextPage,
  };
}

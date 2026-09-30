import { skipToken, useQuery } from '@apollo/client/react';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { SHOPPING_LISTS_PAGE_SIZE } from './useShoppingListsQuery';

/**
 * The account's shopping lists, metadata only — no items. Public because other
 * features' list pickers and onboarding read it, and a feature's `graphql/` is
 * private to it. It reads the collection the overview holds, so a picker shows
 * the lists offline once the overview has loaded, and asks for the overview's
 * page, so a picker that loads first leaves the overview whole.
 */
export function useShoppingListsLite({
  skip = false,
}: { skip?: boolean } = {}) {
  const { data, loading } = useQuery(
    GetShoppingListsLiteDocument,
    skip ? skipToken : { variables: { first: SHOPPING_LISTS_PAGE_SIZE } },
  );

  return { lists: extractNodes(data?.shoppingLists), loading };
}

import { skipToken, useQuery } from '@apollo/client/react';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';

/**
 * The account's shopping lists, metadata only — no items. Public because other
 * features' list pickers and onboarding read it, and a feature's `graphql/` is
 * private to it. It reads the collection the overview holds, whatever the
 * page size, so a picker shows the lists offline once the overview has loaded.
 */
export function useShoppingListsLite({
  skip = false,
}: { skip?: boolean } = {}) {
  const { data, loading } = useQuery(
    GetShoppingListsLiteDocument,
    skip ? skipToken : {},
  );

  return { lists: extractNodes(data?.shoppingLists), loading };
}

import { useQuery } from '@apollo/client/react';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';

/**
 * The account's shopping lists, metadata only — no items. Public because
 * onboarding shows what already exists before offering to create one, and a
 * feature's `graphql/` is private to it.
 */
export function useShoppingListsLite({
  skip = false,
}: { skip?: boolean } = {}) {
  const { data, loading } = useQuery(GetShoppingListsLiteDocument, { skip });

  return { lists: extractNodes(data?.shoppingLists), loading };
}

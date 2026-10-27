import { skipToken, useQuery } from '@apollo/client/react';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';
import {
  heldFetchPolicy,
  type StandDownOptions,
} from '#hooks/apollo/standDownOptions';
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
  fetchPolicy,
}: StandDownOptions = {}) {
  const { data, loading, refetch } = useQuery(
    GetShoppingListsLiteDocument,
    skip
      ? skipToken
      : {
          variables: { first: SHOPPING_LISTS_PAGE_SIZE },
          ...heldFetchPolicy(fetchPolicy),
        },
  );

  // A failed read answers `undefined`, not "no lists": keep the last answer.
  const lists = usePreservedNodes(data?.shoppingLists, 'GetShoppingListsLite');

  return {
    lists,
    loading,
    // A query skipped from mount has no variables, so a refetch would send none.
    refetch: async () => {
      if (skip) return;
      await refetch();
    },
  };
}

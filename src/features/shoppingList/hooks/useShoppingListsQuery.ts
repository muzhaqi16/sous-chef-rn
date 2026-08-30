import { useQuery } from '@apollo/client/react';
import {
  GetShoppingListsLiteDocument,
  type GetShoppingListsLiteQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

type ShoppingListEdge = NonNullable<
  GetShoppingListsLiteQuery['shoppingLists']['edges']
>[number];
export type ShoppingListFromQuery = NonNullable<
  NonNullable<ShoppingListEdge>['node']
>;

/**
 * List METADATA only — no items, collaborators or home membership, which come
 * from `useShoppingListItemsQuery` for the selected list. Returns every list the
 * user has, home-based and personal; `useShoppingListSelection` narrows it.
 */
export function useShoppingListsQuery() {
  const { data, previousData, loading, error, refetch } = useQuery(
    GetShoppingListsLiteDocument,
    {
      variables: { first: 50 },
    },
  );

  useApolloErrorLogger('GetShoppingListsLite', error);

  const fetchLists = () => {
    refetch();
  };

  // Falls back to the previous result so a failed refetch keeps the lists on screen.
  const currentNodes = extractNodes(data?.shoppingLists);
  const previousNodes = extractNodes(previousData?.shoppingLists);
  const lists: ShoppingListFromQuery[] =
    currentNodes.length > 0 ? currentNodes : previousNodes;

  return {
    lists,
    loading,
    error,
    // `data !== undefined` — a response arrived, empty or not. `previousData`
    // counts too: a failed refetch over lists we already have is not "we never
    // got an answer".
    hasResult: data !== undefined || previousData !== undefined,
    refetch,
    fetchLists,
  };
}

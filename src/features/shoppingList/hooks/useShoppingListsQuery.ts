import { useQuery } from '@apollo/client/react';
import {
  GetShoppingListsLiteDocument,
  type GetShoppingListsLiteQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

// Extract the shopping list type from the lite query (metadata only)
// Uses NonNullable to extract the node type from the connection edges
type ShoppingListEdge = NonNullable<
  GetShoppingListsLiteQuery['shoppingLists']['edges']
>[number];
export type ShoppingListFromQuery = NonNullable<
  NonNullable<ShoppingListEdge>['node']
>;

/**
 * useShoppingListsQuery - Query shopping lists with smart caching (LIGHTWEIGHT)
 *
 * Single responsibility:
 * - Fetch all user's shopping lists METADATA ONLY (no items, no collaborators)
 * - Use cache-and-network for best UX (instant cache display + fresh data)
 * - Provide fetchLists() for manual refresh (e.g., when selector opens)
 * - Provide stable lists array with fallback to previous data
 *
 * PERFORMANCE: Uses GetShoppingListsLite query to reduce API complexity.
 * - Only fetches list metadata (id, name, totalItems, etc.)
 * - NO itemsConnection (items fetched via GetShoppingListItemsFiltered)
 * - NO collaboratorsConnection (fetched via GetShoppingListDetails)
 * - NO home.membersConnection/myMembership (fetched via GetShoppingListDetails)
 *
 * Note: For detailed list data (items, permissions, collaborators), use
 * useShoppingListItemsQuery with the current list ID.
 */
export function useShoppingListsQuery() {
  // PERFORMANCE: cache-and-network shows cached data immediately + fetches fresh in background
  // - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders (fixes infinite loop)
  // - Pull-to-refresh calls refetch() for fresh data
  // - Fetches ALL user's lists (home-based and personal) - filtering happens in useShoppingListSelection
  const { data, previousData, loading, error, refetch } = useQuery(
    GetShoppingListsLiteDocument,
    {
      variables: { first: 50 },
    },
  );

  useApolloErrorLogger('GetShoppingListsLite', error);

  // Function to trigger fresh fetch - call when selector opens for latest data
  const fetchLists = () => {
    refetch();
  };

  // Stable lists array with fallback to previous data (graceful degradation on network error)
  // Extract nodes from connection type (shoppingLists returns ShoppingListConnection)
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
    fetchLists, // Call this when selector opens to trigger fresh fetch
  };
}

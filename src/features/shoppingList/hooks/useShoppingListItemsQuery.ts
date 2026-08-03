import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  GetShoppingListDetailsDocument,
  type GetShoppingListDetailsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

// Export the shopping list detail type
export type ShoppingListDetail = NonNullable<
  GetShoppingListDetailsQuery['shoppingList']
>;

/**
 * useShoppingListItemsQuery - Query shopping list details (permissions, collaborators)
 *
 * Single responsibility:
 * - Fetch full details for a specific shopping list (WITHOUT items)
 * - Handle offline-aware fetch policy
 * - Provide shoppingList details for permissions and collaborators
 *
 * Items are fetched separately by usePaginatedShoppingItems via GetShoppingListItemsFiltered.
 * This hook is consumed by useShoppingListManagement for data orchestration.
 */
export function useShoppingListItemsQuery(listId: string | null | undefined) {
  const isLoggedOut = useIsLoggedOut();

  // Explicit validation - only execute query when listId is genuinely valid
  const hasValidListId = !!listId && !isLoggedOut;

  // PERFORMANCE: cache-and-network shows cached data immediately + fetches fresh in background
  // - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders (fixes infinite loop)
  // - errorPolicy: 'all' returns cached data when network fails (offline graceful degradation)
  // - skip controls execution - when skip is false, listId is guaranteed valid
  const { data, previousData, loading, error, refetch } = useQuery(
    GetShoppingListDetailsDocument,
    {
      variables: {
        id: listId!,
      },
      skip: !hasValidListId,
    },
  );

  useApolloErrorLogger('GetShoppingListDetails', error);

  // Track previous listId to detect list switches.
  // When switching lists, we should NOT fall back to previousData (it's from old list).
  // "Adjusting state during render" — comparing previousListId to listId and
  // updating in the same render avoids the cascading-render warning that
  // setState-in-useEffect triggers under react-hooks/recommended-latest.
  const [previousListId, setPreviousListId] = useState<
    string | null | undefined
  >(listId);
  const listIdChanged = previousListId !== listId;
  if (listIdChanged) {
    setPreviousListId(listId);
  }

  // Extract the shopping list detail (with previousData fallback for same list)
  // Used for permissions, collaborators, and home membership
  const shoppingList: ShoppingListDetail | null = listIdChanged
    ? data?.shoppingList ?? null
    : data?.shoppingList ?? previousData?.shoppingList ?? null;

  // The server returned an explicit null for this list — it was deleted/unshared
  // (a missing by-id record is null data, not a NOT_FOUND error). Distinct from
  // an access-revoked read, which still surfaces as a FORBIDDEN `error`.
  // Gated on !loading/!listIdChanged so a transition's stale null can't flag a
  // freshly selected list as missing before its own fetch resolves.
  const notFound =
    !listIdChanged && !loading && !error && data?.shoppingList === null;

  return {
    // Full shopping list data (for permissions, collaborators, home membership)
    shoppingList,
    notFound,
    loading,
    error,
    refetch,
  };
}

import { useState, useEffect } from 'react';
import { useGetShoppingListDetailsQuery, GetShoppingListDetailsQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

// Export the shopping list detail type
export type ShoppingListDetail = NonNullable<GetShoppingListDetailsQuery['shoppingList']>;

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
  const { isLoggedOut } = useAuth();

  // Explicit validation - only execute query when listId is genuinely valid
  const hasValidListId = !!listId && !isLoggedOut;

  // PERFORMANCE: cache-and-network shows cached data immediately + fetches fresh in background
  // - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders (fixes infinite loop)
  // - errorPolicy: 'all' returns cached data when network fails (offline graceful degradation)
  // - skip controls execution - when skip is false, listId is guaranteed valid
  const { data, previousData, loading, error, refetch } =
    useGetShoppingListDetailsQuery({
      variables: {
        id: listId!,
      },
      skip: !hasValidListId,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      errorPolicy: 'all',
    });

  useApolloErrorLogger('GetShoppingListDetails', error);

  // Track previous listId to detect list switches
  // When switching lists, we should NOT fall back to previousData (it's from old list)
  const [previousListId, setPreviousListId] = useState<string | null | undefined>(listId);
  const listIdChanged = previousListId !== listId;

  // Update state after comparison
  useEffect(() => {
    setPreviousListId(listId);
  }, [listId]);

  // Extract the shopping list detail (with previousData fallback for same list)
  // Used for permissions, collaborators, and home membership
  const shoppingList: ShoppingListDetail | null = listIdChanged
    ? data?.shoppingList ?? null
    : data?.shoppingList ?? previousData?.shoppingList ?? null;

  return {
    // Full shopping list data (for permissions, collaborators, home membership)
    shoppingList,
    loading,
    error,
    refetch,
  };
}

import { useMemo } from 'react';
import { useGetShoppingListItemsQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { useOfflineAwareFetchPolicy, OFFLINE_FETCH_POLICIES } from '#/apollo/policies/offlineFetchPolicies';

/**
 * Hook for querying shopping list items
 * Handles data fetching, loading states, and offline-aware fetch policies
 */
export function useShoppingListQuery(listId: string | undefined) {
  const { isLoggedOut } = useAuth();
  const shouldSkip = !listId || isLoggedOut;

  // Dynamic fetch policy based on network status
  // Online: cache-and-network (fresh data + instant UI)
  // Offline: cache-only (stops network thrashing and loading flickers)
  const fetchPolicy = useOfflineAwareFetchPolicy(
    OFFLINE_FETCH_POLICIES.LIST.online,   // 'cache-and-network'
    OFFLINE_FETCH_POLICIES.LIST.offline   // 'cache-only'
  );

  // Watch cache for updates from mutations and subscriptions
  const {
    data,
    loading,
    error,
    refetch,
  } = useGetShoppingListItemsQuery({
    variables: {
      shoppingListId: listId ?? '',
    },
    skip: shouldSkip,
    fetchPolicy,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all', // Return both data and errors for better debugging
  });

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // This eliminates duplicate subscription code and provides consistent behavior
  // across all subscriptions (deduplication, error handling, logging)

  const items = useMemo(
    () => data?.shoppingListItems || [],
    [data?.shoppingListItems],
  );

  return {
    items,
    loading,
    error,
    refetch,
  };
}

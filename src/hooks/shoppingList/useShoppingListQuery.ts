import { useMemo } from 'react';
import { useGetShoppingListQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { useOfflineAwareFetchPolicy, OFFLINE_FETCH_POLICIES } from '#/apollo/policies/offlineFetchPolicies';

/**
 * Hook for querying shopping list items
 * Handles data fetching, loading states, and offline-aware fetch policies
 * Uses GetShoppingList query with itemsConnection as single source of truth
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
  // Uses GetShoppingList with itemsConnection as single source of truth
  const {
    data,
    loading,
    error,
    refetch,
  } = useGetShoppingListQuery({
    variables: {
      id: listId ?? '',
    },
    skip: shouldSkip,
    fetchPolicy,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all', // Return both data and errors for better debugging
  });

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // This eliminates duplicate subscription code and provides consistent behavior
  // across all subscriptions (deduplication, error handling, logging)

  // Memoize edges to avoid recreating empty array on every render
  const edges = useMemo(
    () => data?.shoppingList?.itemsConnection?.edges || [],
    [data?.shoppingList?.itemsConnection?.edges],
  );

  // Create a key that changes when ANY item's sortOrder changes
  // This ensures useMemo recalculates even if edges array reference stays the same
  // (Apollo's normalized cache may update items without changing array reference)
  const sortOrderKey = useMemo(
    () => edges.map(edge => `${edge.node.id}:${edge.node.sortOrder}`).join(','),
    [edges],
  );

  const items = useMemo(() => {
    // Extract items from itemsConnection edges
    const rawItems = edges.map(edge => edge.node);

    // Sort items to ensure consistent order across reloads
    // Server should return items sorted, but we enforce it client-side as well
    // Sort by: isPurchased ASC -> sortOrder ASC
    return [...rawItems].sort((a, b) => {
      // First by purchased status (unpurchased items first)
      if (a.isPurchased !== b.isPurchased) {
        return a.isPurchased ? 1 : -1;
      }

      // Then by sortOrder (fractional indexing strings)
      if (a.sortOrder && b.sortOrder) {
        return a.sortOrder.localeCompare(b.sortOrder);
      }

      // Items without sortOrder come last
      return 0;
    });
    // sortOrderKey dependency ensures re-sort when any item's sortOrder changes
    // even if edges array reference stays the same (Apollo cache normalization)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, sortOrderKey]);

  return {
    items,
    loading,
    error,
    refetch,
  };
}

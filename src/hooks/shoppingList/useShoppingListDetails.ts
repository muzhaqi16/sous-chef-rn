import { NetworkStatus } from '@apollo/client';
import { useGetShoppingListDetailsQuery } from '#generated';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';

export function useShoppingListDetails(listId: string | undefined) {
  // Fetch policies per docs/apollo-client-patterns.md:
  // - cache-and-network: Shows cache immediately, fetches fresh in background
  // - nextFetchPolicy: cache-first prevents re-fetch on re-render/tab switch
  // - notifyOnNetworkStatusChange: Enables tracking of refetch status

  const { data, loading, error, refetch, networkStatus } =
    useGetShoppingListDetailsQuery({
      variables: { id: listId ?? '' },
      skip: !listId,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      errorPolicy: 'ignore',
      notifyOnNetworkStatusChange: true,
    });

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // The ShoppingListUpdated subscription automatically updates the cache via
  // Apollo's normalization, eliminating the need for manual client.writeQuery

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const shoppingList = usePreservedQueryData(data?.shoppingList, null);
  const isRefetching = networkStatus === NetworkStatus.refetch;

  return {
    shoppingList,
    loading,
    isRefetching,
    error,
    refetch,
    // Convenience properties
    name: shoppingList?.name || '',
    isDefault: shoppingList?.isDefault || false,
    collaborators:
      shoppingList?.collaboratorsConnection?.edges.map(edge => edge.node) || [],
    isShared: (shoppingList?.collaboratorsConnection?.edges.length || 0) > 0,
  };
}

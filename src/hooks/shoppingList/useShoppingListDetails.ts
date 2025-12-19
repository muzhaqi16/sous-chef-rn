import { useGetShoppingListQuery } from '#generated';

export function useShoppingListDetails(listId: string | undefined) {
  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-first: Uses cache if available for detail views
  // - errorPolicy: 'ignore' returns cached data when network fails

  const { data, loading, error, refetch } = useGetShoppingListQuery({
    variables: { id: listId ?? '' },
    skip: !listId,
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // The ShoppingListUpdated subscription automatically updates the cache via
  // Apollo's normalization, eliminating the need for manual client.writeQuery

  const shoppingList = data?.shoppingList || null;

  return {
    shoppingList,
    loading,
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

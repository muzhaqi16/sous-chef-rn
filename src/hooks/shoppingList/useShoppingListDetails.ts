import { useGetShoppingListQuery } from '#generated';

export function useShoppingListDetails(listId: string | undefined) {
  const {data, loading, error, refetch} = useGetShoppingListQuery({
    variables: {id: listId ?? ''},
    skip: !listId,
    fetchPolicy: 'cache-and-network',
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
    collaborators: shoppingList?.collaborators || [],
    isShared: (shoppingList?.collaborators?.length || 0) > 0,
  };
}

import { useGetShoppingListQuery } from '#generated';
import { useOfflinePresetPolicy } from '#/apollo/policies/offlineFetchPolicies';

export function useShoppingListDetails(listId: string | undefined) {
  // PERFORMANCE: Use offline-aware fetch policy preset for consistency
  const fetchPolicy = useOfflinePresetPolicy('DETAIL');

  const { data, loading, error, refetch } = useGetShoppingListQuery({
    variables: { id: listId ?? '' },
    skip: !listId,
    fetchPolicy,
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

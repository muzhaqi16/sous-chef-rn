import {
  useGetShoppingListQuery,
  useShoppingListUpdatedSubscription,
  GetShoppingListDocument,
} from '#generated';

export function useShoppingListDetails(listId: string | undefined) {
  const {data, loading, error, refetch} = useGetShoppingListQuery({
    variables: {id: listId ?? ''},
    skip: !listId,
    fetchPolicy: 'cache-and-network',
  });

  useShoppingListUpdatedSubscription({
    variables: {listId: listId!},
    skip: !listId,
    onData: ({data: subscriptionData, client}) => {
      const updatedList = subscriptionData?.data?.shoppingListUpdated;

      if (!updatedList || !listId) {
        console.warn(
          'Invalid shoppingListMetadataUpdated payload',
          subscriptionData,
        );
        return;
      }

      // Update the cache with the new list data
      client.writeQuery({
        query: GetShoppingListDocument,
        variables: {id: listId},
        data: {
          shoppingList: updatedList,
        },
      });
    },
  });

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

import {
  useGetShoppingListItemsQuery,
  useShoppingListItemsChangedSubscription,
  GetShoppingListItemsDocument,
} from '#generated';
import {useSearchableList} from '../useSearchableList';

export function useShoppingList(listId: string | null) {
  const {data, refetch} = useGetShoppingListItemsQuery({
    variables: {shoppingListId: listId ?? ''},
    skip: !listId,
    fetchPolicy: 'cache-and-network',
  });

  // Subscribe to all item changes (added, updated, removed)
  useShoppingListItemsChangedSubscription({
    variables: {listId: listId!},
    skip: !listId,
    onData: ({data: subscriptionData, client}) => {
      const changeData = subscriptionData?.data?.shoppingListItemsChanged;

      if (!changeData || !listId) {
        console.warn(
          'Invalid shoppingListItemsChanged payload',
          subscriptionData,
        );
        return;
      }

      const {mutation, item} = changeData;

      if (!item || !item.id) {
        console.warn('Invalid item data in subscription payload:', changeData);
        return;
      }

      // Read current items from cache
      try {
        const cacheData = client.readQuery({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
        });

        if (!cacheData?.shoppingListItems) {
          console.warn('No cache data found, refetching...');
          refetch();
          return;
        }

        let newItems = [...cacheData.shoppingListItems];

        switch (mutation) {
          case 'CREATED':
            // Add new item if it doesn't already exist
            const itemExists = newItems.some(
              existingItem => existingItem.id === item.id,
            );
            if (!itemExists) {
              newItems.push(item);
            }
            break;

          case 'UPDATED':
            // Update existing item
            newItems = newItems.map(existingItem =>
              existingItem.id === item.id
                ? {...existingItem, ...item}
                : existingItem,
            );
            break;

          case 'DELETED':
            // Remove item
            newItems = newItems.filter(
              existingItem => existingItem.id !== item.id,
            );
            break;

          default:
            console.warn('Unknown mutation type:', mutation);
            return;
        }

        // Write updated list back to cache
        client.writeQuery({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
          data: {
            shoppingListItems: newItems,
          },
        });

        console.log(`Successfully handled ${mutation} for item:`, item.id);
      } catch (error) {
        console.error('Cache update failed, falling back to refetch:', error);
        // If cache update fails, fallback to refetching
        refetch();
      }
    },
    onError: error => {
      console.error('Subscription error:', error);
      // On subscription error, refetch to ensure we have current data
      refetch();
    },
  });

  const items = data?.shoppingListItems || [];

  const {query, setQuery, filtered} = useSearchableList(
    items,
    (it, q) =>
      !!it.itemName && it.itemName.toLowerCase().includes(q.toLowerCase()),
  );

  return {items: filtered, query, setQuery, refetch};
}

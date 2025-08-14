import {
  useGetShoppingListItemsQuery,
  useShoppingListUpdatedSubscription,
  GetShoppingListItemsDocument,
  ShoppingListItem,
} from '#generated';
import {useSearchableList} from '..';

export function useShoppingList(listId: string | null) {
  const {data} = useGetShoppingListItemsQuery({
    variables: {shoppingListId: listId ?? ''},
    skip: !listId,
    fetchPolicy: 'cache-and-network',
  });

  useShoppingListUpdatedSubscription({
    variables: {listId: listId!},
    skip: !listId,
    onData: ({data: subscriptionData, client}) => {
      console.log('ShoppingListUpdated subscription data:', subscriptionData);
      const updatedItem = subscriptionData?.data?.shoppingListUpdated;
      if (!updatedItem || !updatedItem.node?.id) {
        console.warn('Invalid shoppingListUpdated payload', subscriptionData);
        return;
      }
      if (!updatedItem || !listId) return;

      // Read current items from cache
      const cacheData = client.readQuery({
        query: GetShoppingListItemsDocument,
        variables: {shoppingListId: listId},
      });

      if (!cacheData?.shoppingListItems) return;

      // Update or replace the item
      const newItems = cacheData.shoppingListItems.map(
        (item: ShoppingListItem) =>
          item.id === updatedItem.node?.id ? updatedItem : item,
      );

      // Write updated list back to cache
      client.writeQuery({
        query: GetShoppingListItemsDocument,
        variables: {shoppingListId: listId},
        data: {
          shoppingListItems: newItems,
        },
      });
    },
  });

  const items = data?.shoppingListItems || [];

  const {query, setQuery, filtered} = useSearchableList(
    items,
    (it, q) =>
      !!it.itemName && it.itemName.toLowerCase().includes(q.toLowerCase()),
  );

  return {items: filtered, query, setQuery};
}

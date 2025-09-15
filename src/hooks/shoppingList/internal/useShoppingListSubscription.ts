import {useCallback} from 'react';
import {
  useShoppingListItemsChangedSubscription,
  GetShoppingListItemsDocument,
  MutationType,
} from '#generated';
import {useStore} from '#store';

interface UseShoppingListSubscriptionOptions {
  onItemsChanged?: (items: any[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to handle real-time subscriptions for shopping list changes
 * 
 * @param listId - The shopping list ID to subscribe to
 * @param options - Configuration options
 */
export function useShoppingListSubscription(
  listId: string | null,
  options: UseShoppingListSubscriptionOptions = {}
) {
  const {onItemsChanged, onError} = options;
  const user = useStore(state => state.user);
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const isLoggedOut = !user;

  // Should skip subscription if no valid listId or user is logging out
  const shouldSkip = !listId || listId === '' || isLoggedOut || isLoggingOut;

  // Handle subscription data
  const handleSubscriptionData = useCallback(
    ({data: subscriptionData, client}: any) => {
      const changeData = subscriptionData?.data?.shoppingListItemsChanged;

      if (!changeData || !listId) {
        console.warn('Invalid subscription payload:', subscriptionData);
        return;
      }

      const {mutation, item} = changeData;

      if (!item || !item.id) {
        console.warn('Invalid item in subscription:', changeData);
        return;
      }

      try {
        // Read current items from Apollo cache
        const cacheData = client.readQuery({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
        });

        if (!cacheData?.shoppingListItems) {
          console.warn('No cache data found for subscription update');
          return;
        }

        let newItems = [...cacheData.shoppingListItems];

        // Apply the mutation to the items
        switch (mutation) {
          case MutationType.Created:
            // Add new item if it doesn't exist
            if (!newItems.some(existingItem => existingItem.id === item.id)) {
              newItems.push(item);
            }
            break;

          case MutationType.ItemUpdated:
            // Update existing item
            newItems = newItems.map(existingItem =>
              existingItem.id === item.id
                ? {...existingItem, ...item}
                : existingItem
            );
            break;

          case MutationType.Deleted:
          case MutationType.ItemRemoved:
            // Remove item
            newItems = newItems.filter(existingItem => existingItem.id !== item.id);
            break;

          case MutationType.ItemAdded:
            // Add item (same as CREATED)
            if (!newItems.some(existingItem => existingItem.id === item.id)) {
              newItems.push(item);
            }
            break;

          case MutationType.ItemCompleted:
            // Update item completion status
            newItems = newItems.map(existingItem =>
              existingItem.id === item.id
                ? {...existingItem, ...item}
                : existingItem
            );
            break;

          default:
            console.warn('Unknown mutation type:', mutation);
            return;
        }

        // Write updated list back to Apollo cache
        client.writeQuery({
          query: GetShoppingListItemsDocument,
          variables: {shoppingListId: listId},
          data: {shoppingListItems: newItems},
        });

        // Notify parent component and update MMKV cache
        if (!isLoggedOut && !isLoggingOut) {
          onItemsChanged?.(newItems);
        }

        console.log(`Successfully handled ${mutation} for item:`, item.id);
      } catch (error) {
        console.error('Failed to handle subscription update:', error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [listId, onItemsChanged, onError, isLoggedOut, isLoggingOut]
  );

  // Handle subscription errors
  const handleSubscriptionError = useCallback(
    (error: any) => {
      console.error('Subscription error:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    },
    [onError]
  );

  // Subscribe to shopping list item changes
  useShoppingListItemsChangedSubscription({
    variables: {listId: listId || ''},
    skip: shouldSkip,
    onData: handleSubscriptionData,
    onError: handleSubscriptionError,
  });
}
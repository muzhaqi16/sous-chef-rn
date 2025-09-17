import { useCallback } from 'react';
import {
  useShoppingListItemsChangedSubscription,
} from '#generated';
import { useAuth } from '#hooks/auth/useAuth';

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
  options: UseShoppingListSubscriptionOptions = {},
) {
  const { onItemsChanged, onError } = options;
  const { isLoggingOut, isLoggedOut, canAttemptQueries } = useAuth();

  // Should skip subscription if no valid listId or user is logging out
  const shouldSkip = !listId || listId === '' || !canAttemptQueries;

  // Simplified subscription handler - just notify about changes
  const handleSubscriptionData = useCallback(
    ({ data: subscriptionData }: any) => {
      const changeData = subscriptionData?.data?.shoppingListItemsChanged;

      if (!changeData || !listId) {
        console.warn('Invalid subscription payload:', subscriptionData);
        return;
      }

      // Simply notify that items have changed - the data hook will handle refetching
      console.log('Shopping list items changed via subscription, notifying parent');
      onItemsChanged?.([]);  // Empty array since parent will refetch
    },
    [listId, onItemsChanged],
  );

  // Handle subscription errors
  const handleSubscriptionError = useCallback(
    (error: any) => {
      console.error('Subscription error:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    },
    [onError],
  );

  // Subscribe to shopping list item changes
  useShoppingListItemsChangedSubscription({
    variables: { listId: listId || '' },
    skip: shouldSkip,
    onData: handleSubscriptionData,
    onError: handleSubscriptionError,
  });
}

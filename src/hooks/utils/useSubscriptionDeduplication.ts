import { useRef } from 'react';

/**
 * Subscription payload structure from GraphQL subscriptions
 */
export interface SubscriptionPayload<T> {
  mutation?: string;
  userId?: string;
  timestamp?: string;
  item?: T;
  node?: T;
  [key: string]: any;
}

/**
 * Hook to deduplicate subscription updates and prevent self-echo
 *
 * Filters out subscription updates from the current user to prevent
 * the "self-echo" problem where a user sees their own mutations
 * reflected back through the subscription.
 *
 * @param currentUserId - ID of the current authenticated user
 * @returns Filter function to use in subscription onData callback
 *
 * @example
 * ```typescript
 * const { currentUserId } = useAuth();
 * const shouldProcessUpdate = useSubscriptionDeduplication(currentUserId);
 *
 * useShoppingListItemsChangedSubscription({
 *   variables: { listId },
 *   onData: ({ data }) => {
 *     if (!shouldProcessUpdate(data.subscriptionData?.data?.shoppingListItemsChanged)) {
 *       return; // Skip self-echo
 *     }
 *     // Process update from other users
 *   }
 * });
 * ```
 */
export function useSubscriptionDeduplication(currentUserId?: string | null) {
  // Track recently processed mutation IDs to prevent duplicates
  const processedMutationsRef = useRef(new Set<string>());

  const shouldProcessUpdate = <T extends any>(payload: SubscriptionPayload<T> | null | undefined): boolean => {
      if (!payload) {
        return false;
      }

      // Filter 1: Skip if this update came from the current user (self-echo prevention)
      if (currentUserId && payload.userId === currentUserId) {
        console.log('⏭️ Skipping self-echo subscription update from current user');
        return false;
      }

      // Filter 2: Check for duplicate updates using timestamp + mutation type
      // This helps in slow network scenarios where subscription might fire multiple times
      if (payload.timestamp && payload.mutation) {
        const mutationKey = `${payload.mutation}-${payload.timestamp}`;

        if (processedMutationsRef.current.has(mutationKey)) {
          console.log('⏭️ Skipping duplicate subscription update:', mutationKey);
          return false;
        }

        // Add to processed set and clean up old entries (keep last 50)
        processedMutationsRef.current.add(mutationKey);
        if (processedMutationsRef.current.size > 50) {
          const firstKey = processedMutationsRef.current.values().next().value;
          if (firstKey) {
            processedMutationsRef.current.delete(firstKey);
          }
        }
      }

      // Passed all filters
      return true;
    };

  return shouldProcessUpdate;
}

/**
 * Helper to extract entity ID from subscription payload
 *
 * Handles different subscription payload structures (item vs node)
 */
export function getEntityIdFromPayload<T extends { id?: string }>(
  payload: SubscriptionPayload<T> | null | undefined,
): string | null | undefined {
  if (!payload) {
    return null;
  }

  return payload.item?.id || payload.node?.id || null;
}

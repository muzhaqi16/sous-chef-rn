/**
 * Shopping List Subscriptions
 *
 * Centralizes all shopping list-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Shopping list items (add/update/delete)
 * - Shopping list metadata (name, status, budget, totals)
 * - Collaborators (add/remove)
 *
 * These subscriptions automatically update the Apollo cache and provide
 * deduplication to prevent self-echo and duplicate updates.
 */

import { useStore } from '#store';
import {
  useShoppingListItemsChangedSubscription,
  useShoppingListUpdatedSubscription,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions';
import { CacheStrategy } from '#/services/subscriptions/types';

/**
 * Initialize shopping list subscriptions for the current user
 *
 * This hook should be called once at the app level (in SubscriptionProvider)
 * It automatically subscribes to relevant shopping list changes based on
 * the user's selected shopping list.
 *
 * @param userId - Current user ID for deduplication
 */
export function useShoppingListSubscriptions(userId?: string) {
  // Get selected shopping list from global store
  // This allows subscriptions to follow the user's current context
  const selectedShoppingListId = useStore(state => state.selectedShoppingListId) || undefined;

  //
  // Shopping List Items Changed Subscription
  // Handles CREATE/UPDATE/DELETE operations on shopping list items
  //
  const itemsHandlers = subscriptionService.register({
    subscriptionName: 'ShoppingListItemsChanged',
    entityType: 'ShoppingListItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC, // Apollo handles full fragment updates
    cacheFieldName: 'shoppingListItems',
    enableLogging: true,
    entityId: selectedShoppingListId,
  });

  useShoppingListItemsChangedSubscription({
    variables: { listId: selectedShoppingListId || '' },
    skip: !selectedShoppingListId,
    ...itemsHandlers,
  });

  //
  // Shopping List Updated Subscription
  // Handles metadata changes (name, status, budget, item counts, totals)
  //
  const metadataHandlers = subscriptionService.register({
    subscriptionName: 'ShoppingListUpdated',
    entityType: 'ShoppingList',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC, // Apollo handles metadata updates
    enableLogging: true,
    entityId: selectedShoppingListId,
  });

  useShoppingListUpdatedSubscription({
    variables: { listId: selectedShoppingListId || '' },
    skip: !selectedShoppingListId,
    ...metadataHandlers,
  });

  // Additional shopping list subscriptions can be added here:
  // - ShoppingListCollaboratorsChanged
  // - ShoppingListStatusChanged
  // - etc.
}

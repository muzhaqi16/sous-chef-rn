/**
 * Shopping List Subscriptions
 *
 * Centralizes all shopping list-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Shopping list items (add/update/delete) - uses custom handler for itemsConnection
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
  useShoppingListCollaboratorsChangedSubscription,
  ShoppingListItemFragmentDoc,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions';
import { CacheStrategy, MutationType } from '#/services/subscriptions/types';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils';

// Cache updaters for ShoppingList.itemsConnection (connection pattern)
const addToShoppingListItemsConnection = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

const removeFromShoppingListItemsConnection = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

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
  // Uses custom handler for ShoppingList.itemsConnection cache updates
  //
  const itemsHandlers = subscriptionService.register({
    subscriptionName: 'ShoppingListItemsChanged',
    entityType: 'ShoppingListItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Disable default - using custom handler for connection pattern
    enableLogging: true,
    entityId: selectedShoppingListId,
    // Custom handler for itemsConnection updates
    // payload IS shoppingListItemsChanged (already extracted by SubscriptionService)
    customOnData: (payload: any, client: any) => {
      if (!payload || !selectedShoppingListId) return;

      const mutation = payload.mutation;
      const item = payload.item;

      if (!item) return;

      if (mutation === MutationType.CREATE) {
        // Add new item to ShoppingList.itemsConnection
        addToShoppingListItemsConnection(client.cache, selectedShoppingListId, item);
      } else if (mutation === MutationType.DELETE) {
        // Remove item from ShoppingList.itemsConnection
        removeFromShoppingListItemsConnection(client.cache, selectedShoppingListId, item.id, {
          evictItem: true,
        });
      } else if (mutation === 'ITEM_UPDATED') {
        // Write updated item data to cache using fragment
        // Apollo does NOT auto-normalize subscription data when using onData callback
        // This handles quantity, sortOrder, purchaseInfo, and all other field updates
        client.cache.writeFragment({
          id: client.cache.identify({ __typename: 'ShoppingListItem', id: item.id }),
          fragment: ShoppingListItemFragmentDoc,
          fragmentName: 'ShoppingListItemFragment',
          data: item,
        });
      }
    },
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

  //
  // Shopping List Collaborators Changed Subscription
  // Handles collaborator add/remove/update operations
  //
  const collaboratorsHandlers = subscriptionService.register({
    subscriptionName: 'ShoppingListCollaboratorsChanged',
    entityType: 'ShoppingListCollaborator',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
    enableLogging: true,
    entityId: selectedShoppingListId,
  });

  useShoppingListCollaboratorsChangedSubscription({
    variables: { listId: selectedShoppingListId || '' },
    skip: !selectedShoppingListId,
    ...collaboratorsHandlers,
  });

  // Additional shopping list subscriptions can be added here:
  // - ShoppingListStatusChanged
  // - etc.
}

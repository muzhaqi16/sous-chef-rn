/**
 * Pantry Subscriptions
 *
 * Centralizes all pantry-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Pantry items (add/update/delete)
 * - Pantry metadata (name, description)
 * - Low stock alerts
 * - Expiring items alerts
 *
 * These subscriptions automatically update the Apollo cache and provide
 * deduplication to prevent self-echo and duplicate updates.
 */

import { useStore } from '#store';
import {
  usePantryItemsChangedSubscription,
  usePantryUpdatedSubscription,
  usePantryLowStockAlertSubscription,
  usePantryExpiringItemsAlertSubscription,
  PantryItemDisplayFragmentDoc,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';
import { MutationType } from '#/graphql/generated/types';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

// Cache updaters for Pantry.itemsConnection (connection pattern)
const addToPantryItemsConnection = createAddToParentConnectionUpdater<any>(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

const removeFromPantryItemsConnection = createRemoveFromParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

/**
 * Initialize pantry subscriptions for the current user
 *
 * This hook should be called once at the app level (in SubscriptionProvider)
 * It automatically subscribes to relevant pantry changes based on
 * the user's selected home and pantry.
 *
 * @param userId - Current user ID for deduplication
 */
export function usePantrySubscriptions(userId?: string) {
  // Get selected pantry from global store
  const selectedPantryId =
    useStore(state => state.selectedPantryId) || undefined;
  const isHomeSelectionReady = useStore(state => state.isHomeSelectionReady);

  //
  // Pantry Items Changed Subscription
  // Handles CREATE/UPDATE/DELETE operations on pantry items
  // Uses custom handler for Pantry.itemsConnection cache updates
  //
  const itemsHandlers = subscriptionService.register({
    subscriptionName: 'PantryItemsChanged',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Disable default - using custom handler for connection pattern
    enableLogging: true,
    entityId: selectedPantryId,
    // Custom handler for itemsConnection updates
    // payload IS pantryItemsChanged (already extracted by SubscriptionService)
    customOnData: (payload: any, client: any) => {
      if (!payload || !selectedPantryId) return;

      const mutation = payload.mutation;
      const item = payload.item;

      if (!item) return;

      if (mutation === MutationType.ItemAdded) {
        // Add new item to Pantry.itemsConnection
        // Note: Server fires both CREATED and ITEM_ADDED for the same entity.
        // We only process ITEM_ADDED as it's the semantic subscription event.
        addToPantryItemsConnection(client.cache, selectedPantryId, item);
      } else if (
        mutation === MutationType.Deleted ||
        mutation === MutationType.ItemRemoved
      ) {
        // Remove item from Pantry.itemsConnection
        removeFromPantryItemsConnection(
          client.cache,
          selectedPantryId,
          item.id,
          {
            evictItem: true,
          },
        );
      } else if (
        mutation === MutationType.Updated ||
        mutation === MutationType.ItemUpdated
      ) {
        // Write updated item to cache
        // Note: When using onData callback, Apollo doesn't auto-normalize
        // so we must explicitly write the fragment
        const cacheId = client.cache.identify({
          __typename: 'PantryItem',
          id: item.id,
        });

        if (cacheId) {
          // Item exists - update it
          client.cache.writeFragment({
            id: cacheId,
            fragment: PantryItemDisplayFragmentDoc,
            fragmentName: 'PantryItemDisplay',
            data: item,
          });
        } else {
          // Item not in cache - add to connection (another user created it)
          addToPantryItemsConnection(client.cache, selectedPantryId, item);
        }
      }
    },
  });

  usePantryItemsChangedSubscription({
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...itemsHandlers,
  });

  //
  // Pantry Updated Subscription
  // Handles metadata changes (name, description)
  //
  const metadataHandlers = subscriptionService.register({
    subscriptionName: 'PantryUpdated',
    entityType: 'Pantry',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
    enableLogging: true,
    entityId: selectedPantryId,
  });

  usePantryUpdatedSubscription({
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...metadataHandlers,
  });

  //
  // Pantry Low Stock Alert Subscription
  // Real-time alerts when items reach reorder point
  //
  const lowStockHandlers = subscriptionService.register({
    subscriptionName: 'PantryLowStockAlert',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Alerts don't need cache updates
    enableLogging: true,
    entityId: selectedPantryId,
  });

  usePantryLowStockAlertSubscription({
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...lowStockHandlers,
  });

  //
  // Pantry Expiring Items Alert Subscription
  // Real-time alerts for items expiring soon
  //
  const expiringHandlers = subscriptionService.register({
    subscriptionName: 'PantryExpiringItemsAlert',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Alerts don't need cache updates
    enableLogging: true,
    entityId: selectedPantryId,
  });

  usePantryExpiringItemsAlertSubscription({
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...expiringHandlers,
  });

  // Additional pantry subscriptions can be added here:
  // - PantryItemUsageChanged
  // - PantryWasteAlert
  // - etc.
}

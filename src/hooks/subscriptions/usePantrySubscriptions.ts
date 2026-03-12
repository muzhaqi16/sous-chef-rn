/**
 * Pantry Subscriptions
 *
 * Centralizes all pantry-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Pantry changes (items add/update/delete, metadata, usage)
 * - Pantry alerts (low stock, expiring items, waste)
 * - Expiration notifications (item expiration reminders)
 *
 * These subscriptions automatically update the Apollo cache and provide
 * deduplication to prevent self-echo and duplicate updates.
 */

import { useAppStore } from '#store/useAppStore';
import {
  usePantryChangesSubscription,
  usePantryAlertsSubscription,
  useExpirationNotificationChangedSubscription,
  PantryItemDisplayFragmentDoc,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';
import { MutationType } from '#generated';
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
    useAppStore(state => state.selectedPantryId) || undefined;
  const isHomeSelectionReady = useAppStore(state => state.isHomeSelectionReady);

  //
  // Pantry Changes Subscription (consolidated)
  // Handles all pantry change events based on changeType:
  // - ITEMS_CHANGED: item add/update/delete via pantryItem field
  // - UPDATED: pantry metadata changes via pantry field
  // - USAGE_CHANGED: usage record changes (no-op for cache)
  //
  const changesHandlers = subscriptionService.register({
    subscriptionName: 'PantryChanges',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Disable default - using custom handler for connection pattern
    enableLogging: true,
    entityId: selectedPantryId,
    customOnData: (payload: any, client: any) => {
      if (!payload || !selectedPantryId) return;

      const changeType = payload.changeType;
      const payloadUserId = payload.userId;

      // Skip self-echo: if this subscription is from our own mutation, skip processing
      // The mutation's cache update already handled it
      if (payloadUserId && userId && payloadUserId === userId) {
        if (__DEV__) {
          console.log('⏭️ [Subscription] Skipping pantry self-echo');
        }
        return;
      }

      switch (changeType) {
        case 'ITEMS_CHANGED': {
          const item = payload.pantryItem;
          const mutation = payload.mutation;

          if (!item) return;

          if (mutation === MutationType.ItemAdded) {
            addToPantryItemsConnection(client.cache, selectedPantryId, item);
          } else if (
            mutation === MutationType.Deleted ||
            mutation === MutationType.ItemRemoved
          ) {
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
            const cacheId = client.cache.identify({
              __typename: 'PantryItem',
              id: item.id,
            });

            if (cacheId) {
              client.cache.writeFragment({
                id: cacheId,
                fragment: PantryItemDisplayFragmentDoc,
                fragmentName: 'PantryItemDisplay',
                data: item,
              });
            } else {
              addToPantryItemsConnection(client.cache, selectedPantryId, item);
            }
          }
          break;
        }
        case 'UPDATED':
          // Pantry metadata updates are handled automatically by Apollo normalization
          break;
        case 'USAGE_CHANGED':
          // Usage changes don't need cache updates currently
          break;
        default:
          break;
      }
    },
  });

  usePantryChangesSubscription({
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...changesHandlers,
  });

  //
  // Pantry Alerts Subscription (consolidated)
  // Handles all alert types: LOW_STOCK, EXPIRING_ITEMS, WASTE
  // Alerts don't need cache updates
  //
  const alertsHandlers = subscriptionService.register({
    subscriptionName: 'PantryAlerts',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Alerts don't need cache updates
    enableLogging: true,
    entityId: selectedPantryId,
  });

  usePantryAlertsSubscription({
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...alertsHandlers,
  });

  //
  // Expiration Notification Subscription
  // Receives real-time expiration alerts for pantry items (CREATED, UPDATED).
  // These are consumed by the notification system, not Apollo cache.
  //
  const expirationHandlers = subscriptionService.register({
    subscriptionName: 'ExpirationNotificationChanged',
    entityType: 'ExpirationNotification',
    enableDeduplication: false, // Server-only events, no self-echo
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    entityId: selectedPantryId,
  });

  useExpirationNotificationChangedSubscription({
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...expirationHandlers,
  });
}

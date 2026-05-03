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

import { useSubscription } from '@apollo/client/react';
import { useAppStore } from '#store/useAppStore';
import {
  PantryChangesDocument,
  PantryAlertsDocument,
  ExpirationNotificationChangedDocument,
  type PantryChangesSubscription,
  type ExpirationNotificationChangedSubscription,
} from '#features/pantry/graphql/pantry.generated';
import { PantryItemDisplayFragmentDoc } from '#features/pantry/graphql/pantryFragments.generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';
import { MutationType } from '#/graphql/generated/schemaTypes';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

type PantryChangesPayload = PantryChangesSubscription['pantryChanged'];
type ExpirationChangePayload =
  ExpirationNotificationChangedSubscription['expirationNotificationChanged'];

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
  const changesHandlers = subscriptionService.register<PantryChangesPayload>({
    subscriptionName: 'PantryChanges',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Disable default - using custom handler for connection pattern
    enableLogging: true,
    entityId: selectedPantryId,
    customOnData: (
      payload: PantryChangesPayload,
      client: SubscriptionApolloClient,
    ) => {
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

          // Skip echoes for items this client is currently deleting. Our
          // mutation already updated the cache correctly (edge removed,
          // totalCount decremented, entity evicted). Re-adding the item
          // here would create drift between `edges` and `totalCount` that
          // used to be masked by `filterPendingDeletes` + an auto-refetch
          // effect. The single source of truth is the Apollo cache.
          if (subscriptionService.isPendingDelete(item.id)) {
            if (__DEV__) {
              console.log(
                '⏭️ [Subscription] Skipping pantry echo for pending-delete',
                item.id,
              );
            }
            return;
          }

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

  useSubscription(PantryChangesDocument, {
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

  useSubscription(PantryAlertsDocument, {
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...alertsHandlers,
  });

  //
  // Expiration Notification Subscription
  // Receives real-time expiration alerts for pantry items (CREATED, UPDATED).
  // Enriches the matching generic notification in Zustand with expiration-specific data
  // (daysUntilExpiry, pantryItem info, expirationNotificationId) so the action sheet
  // can display context and fire expiration-specific mutations.
  //
  // Closure-captured store actions (same pattern as PantryChanges above)
  const linkExpirationData = useAppStore(state => state.linkExpirationData);

  const expirationHandlers =
    subscriptionService.register<ExpirationChangePayload>({
      subscriptionName: 'ExpirationNotificationChanged',
      entityType: 'ExpirationNotification',
      enableDeduplication: false, // Server-only events, no self-echo
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
      entityId: selectedPantryId,
      customOnData: (payload: ExpirationChangePayload) => {
        if (!payload) return;
        const { changeType, notification } = payload;
        if (!notification?.genericNotificationId) return;

        if (changeType === 'CREATED' || changeType === 'UPDATED') {
          linkExpirationData(notification.genericNotificationId, {
            expirationNotificationId: notification.id,
            expirationAction: notification.actionTaken ?? undefined,
            daysUntilExpiry: notification.daysUntilExpiry,
            pantryItemName: notification.pantryItem?.item?.name,
            pantryItemImageUrl: notification.pantryItem?.item?.imageUrl,
          });
        }
      },
    });

  useSubscription(ExpirationNotificationChangedDocument, {
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...expirationHandlers,
  });
}

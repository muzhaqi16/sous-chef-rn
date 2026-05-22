/**
 * Pantry Subscriptions
 *
 * Centralizes all pantry-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Pantry item changes (add/update/delete) via pantryItemChanged
 * - Expiration notifications (created + action-taken) via the new split events
 *
 * These subscriptions automatically update the Apollo cache and provide
 * deduplication to prevent self-echo and duplicate updates.
 */

import { useSubscription } from '@apollo/client/react';
import {
  useAppStore,
  useIsHomeSelectionReady,
  useSelectedPantryId,
} from '#store/useAppStore';
import {
  PantryItemChangedDocument,
  ExpirationNotificationCreatedDocument,
  ExpirationNotificationActionTakenDocument,
  type PantryItemChangedSubscription,
  type ExpirationNotificationCreatedSubscription,
  type ExpirationNotificationActionTakenSubscription,
} from '#features/pantry/graphql/pantry.generated';
import {
  UsePantrySubscriptions_ExpirationNotificationFragmentDoc,
  type UsePantrySubscriptions_ExpirationNotificationFragment,
  UsePantrySubscriptions_PantryItemFragmentDoc,
  type UsePantrySubscriptions_PantryItemFragment,
} from '#hooks/subscriptions/usePantrySubscriptions.generated';
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

type PantryItemChangedPayload =
  PantryItemChangedSubscription['pantryItemChanged'];
type ExpirationCreatedPayload =
  ExpirationNotificationCreatedSubscription['expirationNotificationCreated'];
type ExpirationActionPayload =
  ExpirationNotificationActionTakenSubscription['expirationNotificationActionTaken'];

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
 * Initialize pantry subscriptions for the current user.
 *
 * Subscribes to:
 * - pantryItemChanged: real-time CRUD on pantry items
 * - expirationNotificationCreated / actionTaken: ties expiration metadata
 *   into the generic notification store entries
 *
 * The old pantryAlert subscription was dropped — the new split alerts
 * (pantryLowStockAlert, pantryExpirationAlert, pantryWasteAlert) are
 * available if any consumer wants to subscribe to them directly.
 *
 * @param userId - Current user ID for deduplication
 */
export function usePantrySubscriptions(userId?: string) {
  const selectedPantryId = useSelectedPantryId() || undefined;
  const isHomeSelectionReady = useIsHomeSelectionReady();
  const linkExpirationData = useAppStore(state => state.linkExpirationData);

  const itemHandlers = subscriptionService.register<PantryItemChangedPayload>({
    subscriptionName: 'PantryItemChanged',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    entityId: selectedPantryId,
    customOnData: (
      payload: PantryItemChangedPayload,
      client: SubscriptionApolloClient,
    ) => {
      if (!payload || !selectedPantryId) return;

      const payloadUserId = payload.userId;
      if (payloadUserId && userId && payloadUserId === userId) {
        if (__DEV__) {
          console.log('⏭️ [Subscription] Skipping pantry item self-echo');
        }
        return;
      }

      const itemRef = payload.item;
      const mutation = payload.mutation;
      if (!itemRef) return;

      const item =
        client.cache.readFragment<UsePantrySubscriptions_PantryItemFragment>({
          fragment: UsePantrySubscriptions_PantryItemFragmentDoc,
          fragmentName: 'usePantrySubscriptions_pantryItem',
          from: { __typename: 'PantryItem', id: itemRef.id },
        });
      if (!item) return;

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
          { evictItem: true },
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
            fragment: UsePantrySubscriptions_PantryItemFragmentDoc,
            fragmentName: 'usePantrySubscriptions_pantryItem',
            data: item,
          });
        } else {
          addToPantryItemsConnection(client.cache, selectedPantryId, item);
        }
      }
    },
  });

  useSubscription(PantryItemChangedDocument, {
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...itemHandlers,
  });

  const expirationOnData = (
    notificationRef: { id: string } | undefined,
    client: SubscriptionApolloClient,
  ) => {
    if (!notificationRef) return;
    const notification =
      client.cache.readFragment<UsePantrySubscriptions_ExpirationNotificationFragment>(
        {
          fragment: UsePantrySubscriptions_ExpirationNotificationFragmentDoc,
          fragmentName: 'usePantrySubscriptions_expirationNotification',
          from: {
            __typename: 'ExpirationNotification',
            id: notificationRef.id,
          },
        },
      );
    if (!notification?.genericNotificationId) return;

    linkExpirationData(notification.genericNotificationId, {
      expirationNotificationId: notification.id,
      expirationAction: notification.actionTaken ?? undefined,
      daysUntilExpiry: notification.daysUntilExpiry,
      pantryItemName: notification.pantryItem?.item?.name,
      pantryItemImageUrl: notification.pantryItem?.item?.imageUrl,
    });
  };

  const expirationCreatedHandlers =
    subscriptionService.register<ExpirationCreatedPayload>({
      subscriptionName: 'ExpirationNotificationCreated',
      entityType: 'ExpirationNotification',
      enableDeduplication: false,
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
      entityId: selectedPantryId,
      customOnData: (
        payload: ExpirationCreatedPayload,
        client: SubscriptionApolloClient,
      ) => {
        if (!payload) return;
        expirationOnData(payload.notification, client);
      },
    });

  useSubscription(ExpirationNotificationCreatedDocument, {
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...expirationCreatedHandlers,
  });

  const expirationActionHandlers =
    subscriptionService.register<ExpirationActionPayload>({
      subscriptionName: 'ExpirationNotificationActionTaken',
      entityType: 'ExpirationNotification',
      enableDeduplication: false,
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
      entityId: selectedPantryId,
      customOnData: (
        payload: ExpirationActionPayload,
        client: SubscriptionApolloClient,
      ) => {
        if (!payload) return;
        expirationOnData(payload.notification, client);
      },
    });

  useSubscription(ExpirationNotificationActionTakenDocument, {
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...expirationActionHandlers,
  });
}

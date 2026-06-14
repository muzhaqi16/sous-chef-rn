/**
 * Pantry Subscriptions
 *
 * Centralizes all pantry-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Pantry events (item changes, pantry updates, usage, alerts) via pantryEvents
 * - Expiration notifications (created + action-taken) via the split events
 */

import { useSubscription } from '@apollo/client/react';
import {
  useAppStore,
  useIsHomeSelectionReady,
  useSelectedPantryId,
} from '#store/useAppStore';
import {
  PantryEventsDocument,
  ExpirationNotificationCreatedDocument,
  ExpirationNotificationActionTakenDocument,
  type PantryEventsSubscription,
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
import {
  MutationType,
  PantryEventSubtype,
} from '#/graphql/generated/schemaTypes';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { logger } from '#/utils/environment';

type PantryEventsPayload = PantryEventsSubscription['pantryEvents'];
type ExpirationCreatedPayload =
  ExpirationNotificationCreatedSubscription['expirationNotificationCreated'];
type ExpirationActionPayload =
  ExpirationNotificationActionTakenSubscription['expirationNotificationActionTaken'];

const addToPantryItemsConnection =
  createAddToParentConnectionUpdater<UsePantrySubscriptions_PantryItemFragment>(
    'Pantry',
    'itemsConnection',
    'PantryItem',
  );

const removeFromPantryItemsConnection = createRemoveFromParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

function handleItemChanged(
  payload: PantryEventsPayload,
  client: SubscriptionApolloClient,
  selectedPantryId: string,
) {
  if (payload.node.__typename !== 'PantryItem') return;

  const itemRef = payload.node;
  const mutation = payload.mutation;

  const item =
    client.cache.readFragment<UsePantrySubscriptions_PantryItemFragment>({
      fragment: UsePantrySubscriptions_PantryItemFragmentDoc,
      fragmentName: 'usePantrySubscriptions_pantryItem',
      from: { __typename: 'PantryItem', id: itemRef.id },
    });
  if (!item) return;

  if (subscriptionService.isPendingDelete(item.id)) {
    if (__DEV__) {
      logger.debug(
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
    removeFromPantryItemsConnection(client.cache, selectedPantryId, item.id, {
      evictItem: true,
    });
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
}

/**
 * Initialize pantry subscriptions for the current user.
 *
 * Subscribes to:
 * - pantryEvents: consolidated real-time events (item changes, pantry updates,
 *   usage records, low-stock/expiration alerts)
 * - expirationNotificationCreated / actionTaken: ties expiration metadata
 *   into the generic notification store entries
 *
 * @param userId - Current user ID for deduplication
 */
export function usePantrySubscriptions(userId?: string) {
  const selectedPantryId = useSelectedPantryId() || undefined;
  const isHomeSelectionReady = useIsHomeSelectionReady();
  const linkExpirationData = useAppStore(state => state.linkExpirationData);

  const eventHandlers = subscriptionService.register<PantryEventsPayload>({
    subscriptionName: 'PantryEvents',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    entityId: selectedPantryId,
    customOnData: (
      payload: PantryEventsPayload,
      client: SubscriptionApolloClient,
    ) => {
      if (!payload || !selectedPantryId) return;

      if (payload.actorUserId && userId && payload.actorUserId === userId) {
        if (__DEV__) {
          logger.debug('⏭️ [Subscription] Skipping pantry self-echo');
        }
        return;
      }

      switch (payload.subtype) {
        case PantryEventSubtype.ItemChanged:
          handleItemChanged(payload, client, selectedPantryId);
          break;

        case PantryEventSubtype.PantryUpdated:
        case PantryEventSubtype.UsageChanged:
        case PantryEventSubtype.LowStockAlert:
        case PantryEventSubtype.ExpirationAlert:
        case PantryEventSubtype.WasteAlert:
          if (__DEV__) {
            logger.debug(
              `📡 [Subscription] Pantry event: ${payload.subtype}`,
              payload.node.__typename,
            );
          }
          break;
      }
    },
  });

  useSubscription(PantryEventsDocument, {
    variables: { pantryId: selectedPantryId! },
    skip: !selectedPantryId || !isHomeSelectionReady,
    ...eventHandlers,
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

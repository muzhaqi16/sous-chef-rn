/**
 * Pantry Subscriptions
 *
 * Centralizes all pantry-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Pantry events (item changes, pantry updates, usage, alerts) via pantryEvents
 * - Expiration notifications (created + action-taken), folded into the same stream
 *
 * The event carries the envelope plus the changed entity's id — subscriptions
 * are validated against depth 5, which no fragment spread fits under. Values
 * come from `PantryItemForEvent` and friends, fired only where needed: never
 * for a self-echo, a delete, or a row this device isn't holding.
 */

import { useLinkExpirationData } from '#features/notifications/hooks/useLinkExpirationData';
import { useSubscription } from '@apollo/client/react';
import {
  useIsHomeSelectionReady,
  useSelectedPantryId,
} from '#store/useAppStore';
import {
  PantryEventsDocument,
  type PantryEventsSubscription,
} from '#features/pantry/graphql/pantry.generated';
import {
  ExpirationNotificationForEventDocument,
  PantryItemForEventDocument,
  PantrySummaryForEventDocument,
  UsePantrySubscriptions_ExpirationNotificationFragmentDoc,
  type UsePantrySubscriptions_ExpirationNotificationFragment,
  UsePantrySubscriptions_PantryItemFragmentDoc,
  type UsePantrySubscriptions_PantryItemFragment,
} from './usePantrySubscriptions.generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { fetchEventEntity } from '#/services/subscriptions/fetchEventEntity';
import { isSelfEcho } from '#/services/subscriptions/isSelfEcho';
import { useSubscriptionRejected } from '#/services/subscriptions/rejectedSubscriptions';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';
import { MutationType, PantrySubtype } from '#/graphql/generated/schemaTypes';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { logger } from '#/utils/environment';
import { useSubscriptionTransportRecovery } from '#hooks/subscriptions/useSubscriptionTransportRecovery';

type PantryEventsPayload = PantryEventsSubscription['pantryEvents'];

// Takes a reference, never the read-back entity: `toReference(item, true)`
// merges what it is handed over the stored record, so a denormalized read would
// inline `item` / `unit` / `storageLocation` over their refs.
const addToPantryItemsConnection = createAddToParentConnectionUpdater<{
  __typename: 'PantryItem';
  id: string;
}>('Pantry', 'itemsConnection', 'PantryItem');

const removeFromPantryItemsConnection = createRemoveFromParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

const isAdd = (mutation: MutationType) =>
  mutation === MutationType.Created || mutation === MutationType.ItemAdded;

const isDelete = (mutation: MutationType) =>
  mutation === MutationType.Deleted || mutation === MutationType.ItemRemoved;

/** A complete read means some mounted list holds this row, so an update to it
 *  is worth a round trip. */
function isItemCached(
  client: SubscriptionApolloClient,
  itemId: string,
): boolean {
  const cached =
    client.cache.readFragment<UsePantrySubscriptions_PantryItemFragment>({
      fragment: UsePantrySubscriptions_PantryItemFragmentDoc,
      fragmentName: 'usePantrySubscriptions_pantryItem',
      from: { __typename: 'PantryItem', id: itemId },
    });
  return cached !== null;
}

/**
 * Coalesced pantry summary read-back.
 *
 * The server can emit PANTRY_UPDATED per item change, since the stats are
 * derived — one read per event would be a request per remote add. The values
 * are aggregates, so the last read wins and the intermediate ones are waste.
 */
const SUMMARY_REFRESH_DELAY_MS = 400;
let summaryRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function refreshPantrySummary(
  client: SubscriptionApolloClient,
  pantryId: string,
) {
  if (summaryRefreshTimer) clearTimeout(summaryRefreshTimer);
  summaryRefreshTimer = setTimeout(() => {
    summaryRefreshTimer = null;
    void fetchEventEntity(
      client,
      PantrySummaryForEventDocument,
      { id: pantryId },
      'Pantry',
    );
  }, SUMMARY_REFRESH_DELAY_MS);
}

async function handleItemChanged(
  payload: PantryEventsPayload,
  client: SubscriptionApolloClient,
  selectedPantryId: string,
) {
  if (payload.node.__typename !== 'PantryItem') return;

  const itemId = payload.node.id;
  const mutation = payload.mutation;

  if (subscriptionService.isPendingDelete(itemId)) {
    if (__DEV__) {
      logger.debug(
        '⏭️ [Subscription] Skipping pantry echo for pending-delete',
        itemId,
      );
    }
    return;
  }

  // A delete needs no values — the id is the whole event.
  if (isDelete(mutation)) {
    removeFromPantryItemsConnection(client.cache, selectedPantryId, itemId, {
      evictItem: true,
    });
    return;
  }

  const add = isAdd(mutation);
  if (!add && !isItemCached(client, itemId)) return;

  const data = await fetchEventEntity(
    client,
    PantryItemForEventDocument,
    { id: itemId },
    'PantryItem',
  );
  // Offline, or deleted between the event and this read.
  if (!data?.pantryItem) return;

  // Re-checked after the await: a local delete can start mid-read, and
  // re-adding the row the user just removed is worse than a missed update.
  if (subscriptionService.isPendingDelete(itemId)) return;

  if (add) {
    addToPantryItemsConnection(client.cache, selectedPantryId, {
      __typename: 'PantryItem',
      id: itemId,
    });
  }
  // An update needs nothing further — the read-back normalized the new values.
}

/**
 * Initialize pantry subscriptions for the current user.
 *
 * Subscribes to a single consolidated `pantryEvents` stream carrying every
 * pantry-domain event, discriminated by `subtype`: item changes, pantry/usage
 * updates, low-stock/expiration alerts, and the expiration-notification events
 * (EXPIRATION_NOTIFICATION_CREATED / EXPIRATION_ACTION_TAKEN) that were
 * formerly their own subscriptions. One stream keeps the per-user concurrent-
 * subscription count low (the server caps it cluster-wide).
 *
 * @param userId - Current user ID for deduplication
 */
export function usePantrySubscriptions(userId?: string) {
  const selectedPantryId = useSelectedPantryId() || undefined;
  const isHomeSelectionReady = useIsHomeSelectionReady();
  const linkExpirationData = useLinkExpirationData();
  const rejected = useSubscriptionRejected('PantryEvents');

  const expirationOnData = async (
    notificationId: string,
    client: SubscriptionApolloClient,
  ) => {
    const data = await fetchEventEntity(
      client,
      ExpirationNotificationForEventDocument,
      { id: notificationId },
      'ExpirationNotification',
    );
    if (!data?.expirationNotification) return;

    const notification =
      client.cache.readFragment<UsePantrySubscriptions_ExpirationNotificationFragment>(
        {
          fragment: UsePantrySubscriptions_ExpirationNotificationFragmentDoc,
          fragmentName: 'usePantrySubscriptions_expirationNotification',
          from: { __typename: 'ExpirationNotification', id: notificationId },
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

      // Expiration notifications (folded in from the former
      // expirationNotificationCreated / expirationNotificationActionTaken
      // subscriptions) feed the local notification store. They originate from
      // the background expiration job or another device, so — unlike the other
      // pantry subtypes — they are NOT self-echo filtered. Handle before the
      // actor skip to preserve the legacy subscriptions' behavior.
      if (
        payload.subtype === PantrySubtype.ExpirationNotificationCreated ||
        payload.subtype === PantrySubtype.ExpirationActionTaken
      ) {
        if (payload.node.__typename === 'ExpirationNotification') {
          void expirationOnData(payload.node.id, client);
        }
        return;
      }

      // Keyed on the originating DEVICE: the mutation response already applied
      // this change here, and nowhere else — the same user's other devices
      // still need it.
      if (isSelfEcho(payload, userId)) {
        if (__DEV__) {
          logger.debug('⏭️ [Subscription] Skipping pantry self-echo');
        }
        return;
      }

      switch (payload.subtype) {
        case PantrySubtype.ItemChanged:
          void handleItemChanged(payload, client, selectedPantryId);
          break;

        // An alert is a change to the item's `isLowStock` / `expiresAt` /
        // batch counts, which the event doesn't carry.
        case PantrySubtype.LowStockAlert:
        case PantrySubtype.ExpirationAlert:
        case PantrySubtype.WasteAlert:
          if (
            payload.node.__typename === 'PantryItem' &&
            isItemCached(client, payload.node.id)
          ) {
            void fetchEventEntity(
              client,
              PantryItemForEventDocument,
              { id: payload.node.id },
              'PantryItem',
            );
          }
          break;

        // `Pantry.stats` has a `mergeObjects` field policy, so this narrow
        // read-back merges over the wider `stats` `GetPantry` selects.
        case PantrySubtype.PantryUpdated:
          refreshPantrySummary(client, payload.pantryId);
          break;

        case PantrySubtype.UsageChanged:
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

  const pantrySkip = !selectedPantryId || !isHomeSelectionReady || rejected;
  const pantryEvents = useSubscription(PantryEventsDocument, {
    variables: { pantryId: selectedPantryId! },
    skip: pantrySkip,
    // The envelope's `node` carries only `__typename` + `id`, and every handler
    // reads the entity back with a query, so nothing needs it in the cache.
    // Writing it is actively harmful: `removeItem` evicts the row before the
    // delete mutation fires and the server pushes this event before the
    // mutation resolves, so the write re-created the evicted PantryItem as a
    // bare `{ id }`. Its connection edge stopped dangling, the node now lacked
    // every other field, and Apollo repaired the incomplete GetPantry result
    // by refetching the whole page — one network round-trip per delete.
    fetchPolicy: 'no-cache',
    ...eventHandlers,
  });
  useSubscriptionTransportRecovery('PantryEvents', pantryEvents, pantrySkip);
}

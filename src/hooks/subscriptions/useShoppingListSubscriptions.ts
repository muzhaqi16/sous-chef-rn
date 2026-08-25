/**
 * Shopping List Subscriptions
 *
 * Centralizes all shopping list-related subscriptions using the unified
 * SubscriptionService. The server caps concurrent subscriptions per client
 * (per-user, cluster-wide), so this hook opens exactly ONE stream:
 * - MyShoppingListsEvents (user-scoped): every shopping-list domain event for
 *   all of the user's lists, discriminated by `subtype` — ITEMS_CHANGED,
 *   LIST_UPDATED, STATUS_CHANGED, ITEMS_BATCH_CLEARED, and COLLABORATION_CHANGED
 *   (collaborator lifecycle, folded in from the former per-list
 *   collaborationChanged subscription; mirrors pantryEvents). Connection
 *   membership is maintained for the active list only.
 *
 * This subscription automatically updates the Apollo cache and provides
 * deduplication to prevent self-echo and duplicate updates.
 */

import type { ApolloCache, Reference } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import type { ConnectionData } from '#/apollo/utils/cacheUpdaters';
import { useSelectedShoppingListId } from '#store/useAppStore';
import { useSubscription } from '@apollo/client/react';
import {
  GetShoppingListDetailsDocument,
  MyShoppingListsEventsDocument,
  type MyShoppingListsEventsSubscription,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  MutationType,
  ShoppingListSubtype,
} from '#/graphql/generated/schemaTypes';
import {
  ShoppingListItemForEventDocument,
  ShoppingListSummaryForEventDocument,
  UseShoppingListSubscriptions_ListRefFragmentDoc,
} from './useShoppingListSubscriptions.generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { fetchEventEntity } from '#/services/subscriptions/fetchEventEntity';
import { isSelfEcho } from '#/services/subscriptions/isSelfEcho';
import { useSubscriptionRejected } from '#/services/subscriptions/rejectedSubscriptions';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';

type MyShoppingListsEventsPayload =
  MyShoppingListsEventsSubscription['myShoppingListsEvents'];
import {
  removeFromShoppingListItemsConnection,
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  clearAllPurchasedItemsFromCache,
  addNewItemToShoppingListCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { Telemetry } from '#/services/telemetry';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';
import { useSubscriptionTransportRecovery } from './useSubscriptionTransportRecovery';

/**
 * Cached `itemsConnection` shape as seen inside a `cache.modify` field
 * function — edges wrap normalized node references. `readField` is used to
 * read `sortOrder` off each node ref rather than indexing the object directly.
 */
// Reuses the shared cache.modify connection shape (carries `readonly __ref?`
// so it stays structurally compatible with Apollo's `Reference` value type).
type CachedItemsConnection = ConnectionData;

/** Re-sort shopping list edges by sortOrder after a subscription update.
 *
 * Uses cache.modify so the modifier runs once per storeFieldName variant.
 * When `targetVariant` is provided, only the matching cache variant is sorted;
 * non-matching variants are returned unchanged to avoid unnecessary work.
 *
 * @param targetVariant - Optional substring to match against storeFieldName
 *   (e.g., `'"isPurchased":false'`). If omitted, all variants are sorted.
 */
function resortEdges(
  cache: ApolloCache,
  shoppingListId: string,
  targetVariant?: string,
): void {
  try {
    const t0 = __DEV__ ? performance.now() : 0;

    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: shoppingListId,
    });
    if (!parentCacheId) return;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: CachedItemsConnection | undefined,
          { readField, storeFieldName }: ModifierDetails,
        ) {
          if (!existing?.edges?.length) return existing;

          // Skip sorting for non-matching variants when a target is specified
          if (targetVariant && !storeFieldName.includes(targetVariant)) {
            if (__DEV__) {
              logger.debug(
                `📊 [resortEdges] skipped variant: ${storeFieldName}`,
              );
            }
            return existing;
          }

          if (__DEV__) {
            if (
              !storeFieldName.includes('isPurchased') &&
              !storeFieldName.includes('filters')
            ) {
              logger.warn(
                `⚠️ [resortEdges] unexpected storeFieldName format: ${storeFieldName}`,
              );
            }
            logger.debug(
              `📊 [resortEdges] sorting variant: ${storeFieldName} (${existing.edges.length} edges)`,
            );
          }

          const sortedEdges = [...existing.edges].sort((a, b) => {
            const nodeA = readField<Reference>('node', a);
            const nodeB = readField<Reference>('node', b);
            const sortA =
              (nodeA ? readField<string>('sortOrder', nodeA) : '') || '';
            const sortB =
              (nodeB ? readField<string>('sortOrder', nodeB) : '') || '';
            if (sortA < sortB) return -1;
            if (sortA > sortB) return 1;
            return 0;
          });

          return { ...existing, edges: sortedEdges };
        },
      },
    });

    // resortEdges sorts every cached itemsConnection variant; this is the only
    // measurement of that known-open cost, so it has to report from release.
    const duration = performance.now() - t0;
    Telemetry.histogram('resort_edges_duration_ms', duration);

    if (__DEV__) {
      logger.debug(
        `📊 [resortEdges] duration=${duration.toFixed(
          2,
        )}ms listId=${shoppingListId}`,
      );
    }
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: 'Failed to re-sort edges after subscription update:',
    });
  }
}

/**
 * Animation scheduler function type for coordinating exit animations
 * with subscription cache updates
 */
type ScheduleAnimationFn = (
  itemId: string,
  direction: 1 | -1,
  onComplete: () => void,
) => void;

/**
 * Entry animation scheduler function type for items appearing in destination list
 */
type ScheduleEntryAnimationFn = (itemId: string, direction: 1 | -1) => void;

// Collaborator removal — module scope (constant config, no closure deps) so the
// MyShoppingListsEvents handler can reference it directly.
const removeCollaborator = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'collaboratorsConnection',
  'ShoppingListCollaborator',
);

/**
 * Initialize shopping list subscriptions for the current user
 *
 * This hook should be called once at the app level (in SubscriptionProvider)
 * It automatically subscribes to relevant shopping list changes based on
 * the user's selected shopping list.
 *
 * @param userId - Current user ID for deduplication
 * @param scheduleAnimation - Optional callback to schedule exit animations before cache updates
 * @param scheduleEntryAnimation - Optional callback to schedule entry animations after cache updates
 */
export function useShoppingListSubscriptions(
  userId?: string,
  scheduleAnimation?: ScheduleAnimationFn,
  scheduleEntryAnimation?: ScheduleEntryAnimationFn,
) {
  // Get selected shopping list from global store
  // This allows subscriptions to follow the user's current context
  const selectedShoppingListId = useSelectedShoppingListId() || undefined;
  const rejected = useSubscriptionRejected('MyShoppingListsEvents');

  /**
   * Apply an ITEMS_CHANGED event to the active list. A delete is the id and
   * nothing else; everything else reads the item back first, which writes the
   * new values and leaves only connection membership to do here.
   */
  const applyItemChange = async (
    payload: MyShoppingListsEventsPayload,
    client: SubscriptionApolloClient,
    listId: string,
  ) => {
    if (payload.node?.__typename !== 'ShoppingListItem') {
      logger.warn(
        '⚠️ [MyShoppingListsEvents] ITEMS_CHANGED event without a ShoppingListItem node, skipping cache update',
        { mutation: payload.mutation },
      );
      return;
    }

    const itemId = payload.node.id;
    const mutation = payload.mutation;

    if (
      mutation === MutationType.Deleted ||
      mutation === MutationType.ItemRemoved
    ) {
      const removeItem = () => {
        // PERF: Batch remove + evict + gc into a single observer notification
        client.cache.batch({
          update(cache: ApolloCache) {
            removeFromShoppingListItemsConnection(cache, listId, itemId, {
              evictItem: true,
            });
          },
        });
      };

      if (scheduleAnimation) {
        scheduleAnimation(itemId, -1, removeItem);
      } else {
        removeItem();
      }
      return;
    }

    const isCreate =
      mutation === MutationType.Created || mutation === MutationType.ItemAdded;
    const isCompletedMutation = mutation === MutationType.ItemCompleted;
    const isUncompletedMutation = mutation === MutationType.ItemUncompleted;

    if (
      !isCreate &&
      !isCompletedMutation &&
      !isUncompletedMutation &&
      mutation !== MutationType.ItemUpdated
    ) {
      return;
    }

    const data = await fetchEventEntity(
      client,
      ShoppingListItemForEventDocument,
      { id: itemId },
      'ShoppingListItem',
    );
    // Offline, or deleted between the event and this read.
    if (!data?.shoppingListItem) return;

    if (isCreate) {
      // PERF: Batch so the internal modify + any follow-up writes coalesce into one notification
      client.cache.batch({
        update(cache: ApolloCache) {
          addNewItemToShoppingListCache(cache, listId, { id: itemId });
        },
      });
      return;
    }

    // The envelope names the changed fields, so a reorder is recognized without
    // inspecting the entity.
    const sortOrderChanged = payload.updatedFields.includes('sortOrder');

    if (__DEV__) {
      logger.debug('🔍 [Subscription Cache Debug]', {
        mutation,
        itemId,
        isCompletedMutation,
        isUncompletedMutation,
        sortOrderChanged,
        willMoveItem: isCompletedMutation || isUncompletedMutation,
      });
    }

    if (scheduleAnimation && (isCompletedMutation || isUncompletedMutation)) {
      // Animated path: batch the move + sort in the animation callback.
      const direction: 1 | -1 = isCompletedMutation ? 1 : -1;
      const moveOp = isCompletedMutation
        ? moveShoppingListItemToPurchased
        : moveShoppingListItemToUnpurchased;

      // Sort only the destination variant after the move
      const sortVariant = isCompletedMutation
        ? '"isPurchased":true'
        : '"isPurchased":false';

      scheduleAnimation(itemId, direction, () => {
        // PERF: Batch move + sort into a single cache notification
        client.cache.batch({
          update(cache: ApolloCache) {
            moveOp(cache, listId, { id: itemId });
            if (sortOrderChanged) {
              resortEdges(cache, listId, sortVariant);
            }
          },
        });
        scheduleEntryAnimation?.(itemId, direction);
      });
      return;
    }

    // Determine which variant to sort: completed→purchased, uncompleted→unpurchased,
    // otherwise sort all variants (general ItemUpdated — variant unknown)
    const nonAnimSortVariant = isCompletedMutation
      ? '"isPurchased":true'
      : isUncompletedMutation
      ? '"isPurchased":false'
      : undefined;

    // A plain field edit: the read-back applied it, and nothing moved.
    if (!isCompletedMutation && !isUncompletedMutation && !sortOrderChanged) {
      return;
    }

    // PERF: Non-animated path — batch ALL cache operations into a single
    // observer notification. This prevents cascading re-renders when
    // the move + sort would otherwise trigger 2-3 notifications.
    client.cache.batch({
      update(cache: ApolloCache) {
        if (isCompletedMutation) {
          moveShoppingListItemToPurchased(cache, listId, { id: itemId });
        } else if (isUncompletedMutation) {
          moveShoppingListItemToUnpurchased(cache, listId, { id: itemId });
        }

        if (sortOrderChanged) {
          resortEdges(cache, listId, nonAnimSortVariant);
        }
      },
    });
  };

  //
  // My Shopping Lists Events Subscription (consolidated)
  // One user-scoped stream carries every shopping-list domain event for ALL
  // of the user's lists, discriminated by `subtype` (mirrors pantryEvents):
  // - ITEMS_CHANGED: item add/update/delete + purchased moves — connection
  //   membership is maintained only for the active list; other lists'
  //   connections self-correct via cache-and-network on next visit
  // - LIST_UPDATED / STATUS_CHANGED: the list summary is read back for lists
  //   the cache is holding; re-evicts while a local delete is in flight
  // - ITEMS_BATCH_CLEARED: removes the cleared item entities from the active
  //   list's cache so they disappear from every variant
  //
  // Every branch works from the envelope plus an id — subscriptions are
  // validated against depth 5, which no fragment spread fits under.
  //
  const myListsEventsHandlers =
    subscriptionService.register<MyShoppingListsEventsPayload>({
      subscriptionName: 'MyShoppingListsEvents',
      entityType: 'ShoppingList',
      enableDeduplication: true,
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
      customOnData: (
        payload: MyShoppingListsEventsPayload,
        client: SubscriptionApolloClient,
      ) => {
        if (!payload) return;

        if (__DEV__) {
          logger.debug(
            `📊 [Subscription] MyShoppingListsEvents: subtype=${payload.subtype} mutation=${payload.mutation} listId=${payload.listId}`,
          );
        }

        // LIST_UPDATED / STATUS_CHANGED apply to any list. No self-echo skip:
        // the deletion re-eviction must run for the deleting user's own events.
        if (
          payload.subtype === ShoppingListSubtype.ListUpdated ||
          payload.subtype === ShoppingListSubtype.StatusChanged
        ) {
          if (
            payload.node?.__typename === 'ShoppingList' &&
            subscriptionService.isParentDeleting(payload.node.id)
          ) {
            safeEvict(client.cache, 'ShoppingList', payload.node.id);
            return;
          }

          // The mutation response already delivered the new summary — on the
          // device that sent it, which is what this tests.
          if (isSelfEcho(payload, userId)) return;

          // This stream carries every list the user can reach, so read back
          // only the ones the cache is holding.
          const cachedList = client.cache.readFragment({
            fragment: UseShoppingListSubscriptions_ListRefFragmentDoc,
            fragmentName: 'useShoppingListSubscriptions_listRef',
            from: { __typename: 'ShoppingList', id: payload.listId },
          });
          if (cachedList) {
            void fetchEventEntity(
              client,
              ShoppingListSummaryForEventDocument,
              { id: payload.listId },
              'ShoppingList',
            );
          }
          return;
        }

        // Everything below maintains connections for the active list only.
        if (!selectedShoppingListId) return;
        if (payload.listId !== selectedShoppingListId) return;
        if (subscriptionService.isParentDeleting(selectedShoppingListId))
          return;

        // Self-echo skip — this device's own mutation already updated the
        // cache optimistically. Keyed on the originating DEVICE, so the same
        // user's other devices still receive the change.
        if (isSelfEcho(payload, userId)) {
          if (__DEV__) {
            logger.debug('⏭️ [Subscription] Skipping self-echo (same device)');
          }
          return;
        }

        // Collaborator lifecycle for the active list. A removal is the id and
        // nothing else; an add or permission change is a connection change with
        // no `shoppingListCollaborator(id)` root field to read, so the details
        // query that owns `collaboratorsConnection` is refetched.
        if (payload.subtype === ShoppingListSubtype.CollaborationChanged) {
          if (payload.node?.__typename !== 'ShoppingListCollaborator') return;

          if (payload.mutation === MutationType.Deleted) {
            removeCollaborator(
              client.cache,
              selectedShoppingListId,
              payload.node.id,
              { evictItem: true },
            );
            return;
          }

          void client.refetchQueries({
            include: [GetShoppingListDetailsDocument],
          });
          return;
        }

        if (payload.subtype === ShoppingListSubtype.ItemsBatchCleared) {
          clearAllPurchasedItemsFromCache(
            client.cache,
            selectedShoppingListId,
            payload.clearedItemIds || [],
          );
          return;
        }

        if (payload.subtype !== ShoppingListSubtype.ItemsChanged) return;

        void applyItemChange(payload, client, selectedShoppingListId);
      },
    });

  const myListsSkip = !userId || rejected;
  const myListsEvents = useSubscription(MyShoppingListsEventsDocument, {
    skip: myListsSkip,
    // Envelope + id only; handlers read entities back with queries. Left
    // cacheable, Apollo re-creates a just-deleted item as a bare `{ id }` from
    // the server's echo of our own delete. The handler above re-evicts it, and
    // that only avoids a page refetch because Apollo defers its incomplete-
    // result check by a tick — see usePantrySubscriptions for the pantry,
    // which had no such re-eviction and refetched GetPantry on every delete.
    fetchPolicy: 'no-cache',
    ...myListsEventsHandlers,
  });
  useSubscriptionTransportRecovery(
    'MyShoppingListsEvents',
    myListsEvents,
    myListsSkip,
  );
}

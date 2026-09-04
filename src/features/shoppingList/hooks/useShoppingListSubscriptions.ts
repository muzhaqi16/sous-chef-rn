/**
 * The server caps concurrent subscriptions per user cluster-wide, so this opens
 * exactly ONE stream: MyShoppingListsEvents carries every shopping-list domain
 * event for all the user's lists, discriminated by `subtype`. Connection
 * membership is maintained for the ACTIVE list only.
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
} from '#features/shoppingList/cache/connections';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { Telemetry } from '#/services/telemetry';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';
import { useSubscriptionTransportRecovery } from '#hooks/subscriptions/useSubscriptionTransportRecovery';

// The connection as `cache.modify` sees it: edges wrap normalized node refs, so
// `sortOrder` comes from `readField`, never from indexing the object.
type CachedItemsConnection = ConnectionData;

/**
 * Re-sort a list's edges by sortOrder. `cache.modify` runs the modifier once per
 * cached variant; `targetVariant` (a storeFieldName substring such as
 * `'"isPurchased":false'`) narrows it to one, and omitting it sorts them all.
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

type ScheduleAnimationFn = (
  itemId: string,
  direction: 1 | -1,
  onComplete: () => void,
) => void;

type ScheduleEntryAnimationFn = (itemId: string, direction: 1 | -1) => void;

// Collaborator removal — module scope (constant config, no closure deps) so the
// MyShoppingListsEvents handler can reference it directly.
const removeCollaborator = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'collaboratorsConnection',
  'ShoppingListCollaborator',
);

/**
 * Mounted once at app level, by `SubscriptionProvider`. The animation schedulers
 * let a move be animated out before, and in after, the cache write.
 */
export function useShoppingListSubscriptions(
  userId?: string,
  scheduleAnimation?: ScheduleAnimationFn,
  scheduleEntryAnimation?: ScheduleEntryAnimationFn,
) {
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
        // One observer notification for the remove + evict + gc.
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
      // One notification for the internal modify plus any follow-up writes.
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

    // A plain ItemUpdated does not say where the row sits, so all variants sort.
    const nonAnimSortVariant = isCompletedMutation
      ? '"isPurchased":true'
      : isUncompletedMutation
      ? '"isPurchased":false'
      : undefined;

    // A plain field edit: the read-back applied it, and nothing moved.
    if (!isCompletedMutation && !isUncompletedMutation && !sortOrderChanged) {
      return;
    }

    // Batched into one observer notification; unbatched, the move plus the sort
    // fire two or three and cascade re-renders.
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

  // Only the ACTIVE list's connections are maintained; other lists self-correct
  // via cache-and-network on the next visit. Every branch works from the
  // envelope plus an id, because subscriptions are validated against depth 5 and
  // no fragment spread fits under it.
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
    // Envelope + id only, so it must stay uncached: cached, the echo of our own
    // delete re-creates the item as a bare `{ id }`, the list query goes
    // incomplete and Apollo refetches the whole page per delete.
    fetchPolicy: 'no-cache',
    ...myListsEventsHandlers,
  });
  useSubscriptionTransportRecovery(
    'MyShoppingListsEvents',
    myListsEvents,
    myListsSkip,
  );
}

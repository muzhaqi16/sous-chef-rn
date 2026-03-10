/**
 * Shopping List Subscriptions
 *
 * Centralizes all shopping list-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Shopping list changes (items, metadata, collaborators, batch clears, status)
 *
 * These subscriptions automatically update the Apollo cache and provide
 * deduplication to prevent self-echo and duplicate updates.
 */

import type { ApolloCache } from '@apollo/client';
import { useAppStore } from '#store/useAppStore';
import {
  useShoppingListChangesSubscription,
  useMyShoppingListsChangesSubscription,
  useCollaborationChangesSubscription,
  CollaborationChangeType,
  ShoppingListItemDisplayFragmentDoc,
  MutationType,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';
import {
  removeFromShoppingListItemsConnection,
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  clearAllPurchasedItemsFromCache,
  addNewItemToShoppingListCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { Telemetry } from '#/services/telemetry';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

/** Re-sort shopping list edges by sortOrder after a subscription update.
 *
 * Uses cache.modify so the modifier runs once per storeFieldName variant.
 * When `targetVariant` is provided, only the matching cache variant is sorted;
 * non-matching variants are returned unchanged to avoid unnecessary work.
 *
 * @param targetVariant - Optional substring to match against storeFieldName
 *   (e.g., `'"isPurchased":false'`). If omitted, all variants are sorted.
 */
function resortEdges(cache: ApolloCache, shoppingListId: string, targetVariant?: string): void {
  executeCacheUpdate(
    () => {
      const t0 = __DEV__ ? performance.now() : 0;

      const parentCacheId = cache.identify({
        __typename: 'ShoppingList',
        id: shoppingListId,
      });
      if (!parentCacheId) return;

      cache.modify({
        id: parentCacheId,
        fields: {
          itemsConnection(existing: any, { readField, storeFieldName }: any) {
            if (!existing?.edges?.length) return existing;

            // Skip sorting for non-matching variants when a target is specified
            if (targetVariant && !storeFieldName.includes(targetVariant)) {
              if (__DEV__) {
                console.log(`📊 [resortEdges] skipped variant: ${storeFieldName}`);
              }
              return existing;
            }

            if (__DEV__) {
              if (!storeFieldName.includes('isPurchased') && !storeFieldName.includes('filters')) {
                console.warn(`⚠️ [resortEdges] unexpected storeFieldName format: ${storeFieldName}`);
              }
              console.log(`📊 [resortEdges] sorting variant: ${storeFieldName} (${existing.edges.length} edges)`);
            }

            const sortedEdges = [...existing.edges].sort((a: any, b: any) => {
              const nodeA = readField('node', a);
              const nodeB = readField('node', b);
              const sortA = (nodeA ? readField('sortOrder', nodeA) : '') as string || '';
              const sortB = (nodeB ? readField('sortOrder', nodeB) : '') as string || '';
              if (sortA < sortB) return -1;
              if (sortA > sortB) return 1;
              return 0;
            });

            return { ...existing, edges: sortedEdges };
          },
        },
      });

      if (__DEV__) {
        const duration = performance.now() - t0;
        console.log(`📊 [resortEdges] duration=${duration.toFixed(2)}ms listId=${shoppingListId}`);
        Telemetry.histogram('resort_edges_duration_ms', duration);
      }
    },
    'Failed to re-sort edges after subscription update:',
  );
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
  const selectedShoppingListId = useAppStore(state => state.selectedShoppingListId) || undefined;

  //
  // Shopping List Changes Subscription (consolidated)
  // Handles all shopping list events based on changeType:
  // - ITEMS_CHANGED: item add/update/delete
  // - LIST_UPDATED: metadata changes
  // - COLLABORATORS_CHANGED: collaborator updates
  // - ITEMS_BATCH_CLEARED: batch clear of purchased items
  // - STATUS_CHANGED: status transitions (no-op currently)
  //
  const changesHandlers = subscriptionService.register({
    subscriptionName: 'ShoppingListChanges',
    entityType: 'ShoppingListItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Disable default - using custom handler
    enableLogging: true,
    entityId: selectedShoppingListId,
    customOnData: (payload: any, client: any) => {
      if (__DEV__) {
        console.log(`📊 [Subscription] ShoppingListChanges event: changeType=${payload?.changeType} mutation=${payload?.mutation}`);
      }

      if (!payload || !selectedShoppingListId) return;

      // Skip processing if the parent list is being deleted
      if (subscriptionService.isParentDeleting(selectedShoppingListId)) return;

      const changeType = payload.changeType;
      const payloadUserId = payload.userId;

      switch (changeType) {
        case 'ITEMS_CHANGED': {
          const mutation = payload.mutation;
          const item = payload.item;

          if (!item) return;

          if (!item.id) {
            console.warn('⚠️ [ShoppingListChanges] Received item with no id, skipping cache update', {
              changeType,
              mutation: payload.mutation,
            });
            return;
          }

          // Skip self-echo
          if (payloadUserId && userId && payloadUserId === userId) {
            if (__DEV__) {
              console.log('⏭️ [Subscription] Skipping self-echo (same user)', item.id);
            }
            return;
          }

          if (mutation === MutationType.Created || mutation === MutationType.ItemAdded) {
            // PERF: Batch so the internal modify + any follow-up writes coalesce into one notification
            client.cache.batch({
              update(cache: ApolloCache) {
                addNewItemToShoppingListCache(cache, selectedShoppingListId, item);
              },
            });
          } else if (mutation === MutationType.Deleted || mutation === MutationType.ItemRemoved) {
            if (scheduleAnimation) {
              scheduleAnimation(item.id, -1, () => {
                // PERF: Batch remove + evict + gc into a single observer notification
                client.cache.batch({
                  update(cache: ApolloCache) {
                    removeFromShoppingListItemsConnection(cache, selectedShoppingListId, item.id, {
                      evictItem: true,
                    });
                  },
                });
              });
            } else {
              // PERF: Batch remove + evict + gc into a single observer notification
              client.cache.batch({
                update(cache: ApolloCache) {
                  removeFromShoppingListItemsConnection(cache, selectedShoppingListId, item.id, {
                    evictItem: true,
                  });
                },
              });
            }
          } else if (mutation === MutationType.ItemUpdated || mutation === MutationType.ItemCompleted || mutation === MutationType.ItemUncompleted) {
            const sortOrderChanged = item.sortOrder != null;
            const isCompletedMutation = mutation === MutationType.ItemCompleted;
            const isUncompletedMutation = mutation === MutationType.ItemUncompleted;

            if (__DEV__) {
              console.log('🔍 [Subscription Cache Debug]', {
                mutation,
                itemId: item.id,
                isCompletedMutation,
                isUncompletedMutation,
                willMoveItem: isCompletedMutation || isUncompletedMutation,
              });
            }

            if (scheduleAnimation && (isCompletedMutation || isUncompletedMutation)) {
              // Animated path: write fragment immediately for visual feedback,
              // then batch the move + sort in the animation callback
              client.cache.writeFragment({
                id: client.cache.identify({ __typename: 'ShoppingListItem', id: item.id }),
                fragment: ShoppingListItemDisplayFragmentDoc,
                fragmentName: 'ShoppingListItemDisplayFragment',
                data: item,
              });

              const direction: 1 | -1 = isCompletedMutation ? 1 : -1;
              const moveOp = isCompletedMutation
                ? moveShoppingListItemToPurchased
                : moveShoppingListItemToUnpurchased;

              // Sort only the destination variant after the move
              const sortVariant = isCompletedMutation
                ? '"isPurchased":true'
                : '"isPurchased":false';

              scheduleAnimation(item.id, direction, () => {
                // PERF: Batch move + sort into a single cache notification
                client.cache.batch({
                  update(cache: ApolloCache) {
                    moveOp(cache, selectedShoppingListId, item);
                    if (sortOrderChanged) {
                      resortEdges(cache, selectedShoppingListId, sortVariant);
                    }
                  },
                });
                scheduleEntryAnimation?.(item.id, direction);
              });
            } else {
              // Determine which variant to sort: completed→purchased, uncompleted→unpurchased,
              // otherwise sort all variants (general ItemUpdated — variant unknown)
              const nonAnimSortVariant = isCompletedMutation
                ? '"isPurchased":true'
                : isUncompletedMutation
                  ? '"isPurchased":false'
                  : undefined;

              // PERF: Non-animated path — batch ALL cache operations into a single
              // observer notification. This prevents cascading re-renders when
              // writeFragment + move + sort would otherwise trigger 2-3 notifications.
              client.cache.batch({
                update(cache: ApolloCache) {
                  cache.writeFragment({
                    id: cache.identify({ __typename: 'ShoppingListItem', id: item.id }),
                    fragment: ShoppingListItemDisplayFragmentDoc,
                    fragmentName: 'ShoppingListItemDisplayFragment',
                    data: item,
                  });

                  if (isCompletedMutation) {
                    moveShoppingListItemToPurchased(cache, selectedShoppingListId, item);
                  } else if (isUncompletedMutation) {
                    moveShoppingListItemToUnpurchased(cache, selectedShoppingListId, item);
                  }

                  if (sortOrderChanged) {
                    resortEdges(cache, selectedShoppingListId, nonAnimSortVariant);
                  }
                },
              });
            }
          }
          break;
        }
        case 'LIST_UPDATED': {
          // Metadata updates - handle deletion re-eviction
          const node = payload.shoppingList;
          if (!node?.id) return;
          if (subscriptionService.isParentDeleting(node.id)) {
            const cacheId = client.cache.identify({ __typename: 'ShoppingList', id: node.id });
            if (cacheId) {
              client.cache.evict({ id: cacheId });
              client.cache.gc();
            }
          }
          break;
        }
        case 'COLLABORATORS_CHANGED':
          // Collaborator updates are handled automatically by Apollo normalization
          break;
        case 'ITEMS_BATCH_CLEARED': {
          const clearedItemIds = payload.clearedItemIds || [];

          // Skip self-echo
          if (payloadUserId && userId && payloadUserId === userId) {
            if (__DEV__) {
              console.log('⏭️ [Subscription] Skipping batch clear self-echo');
            }
            return;
          }

          clearAllPurchasedItemsFromCache(client.cache, selectedShoppingListId, clearedItemIds);
          break;
        }
        case 'STATUS_CHANGED':
          // Currently unused
          break;
        default:
          break;
      }
    },
  });

  useShoppingListChangesSubscription({
    variables: { listId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...changesHandlers,
  });

  //
  // My Shopping Lists Changes Subscription
  // Handles list-level metadata updates across all user's shopping lists:
  // - LIST_UPDATED / STATUS_CHANGED / ITEMS_CHANGED / ITEMS_BATCH_CLEARED / COLLABORATORS_CHANGED
  // Also handles CREATED / DELETED mutations for the shoppingLists connection
  //
  const addToShoppingLists = createAddToQueryConnectionUpdater<{ id: string }>('shoppingLists', 'ShoppingList');
  const removeFromShoppingLists = createRemoveFromQueryConnectionUpdater('shoppingLists', 'ShoppingList');

  const myListsHandlers = subscriptionService.register({
    subscriptionName: 'MyShoppingListsChanges',
    entityType: 'ShoppingList',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    customOnData: (payload: any, client: any) => {
      if (!payload) return;

      // Skip self-echo
      if (payload.userId && userId && payload.userId === userId) {
        if (__DEV__) {
          console.log('⏭️ [MyShoppingListsChanges] Skipping self-echo');
        }
        return;
      }

      const mutation = payload.mutation;
      const shoppingList = payload.shoppingList;

      // Handle list creation/deletion via mutation field
      if (mutation === MutationType.Created && shoppingList?.id) {
        addToShoppingLists(client.cache, shoppingList);
        return;
      }

      if (mutation === MutationType.Deleted && payload.listId) {
        removeFromShoppingLists(client.cache, payload.listId, { evictItem: true });
        return;
      }

      // For all other changeTypes (LIST_UPDATED, STATUS_CHANGED, ITEMS_CHANGED,
      // ITEMS_BATCH_CLEARED, COLLABORATORS_CHANGED), Apollo auto-normalizes the
      // shoppingList entity by id — the returned metadata fields (totalItems,
      // completedItems, name, status, isCompleted, estimatedTotal) merge automatically.
    },
  });

  useMyShoppingListsChangesSubscription({
    skip: !userId,
    ...myListsHandlers,
  });

  //
  // Collaboration Changes Subscription
  // Handles collaborator lifecycle for the currently selected shopping list:
  // - MEMBER_ADDED / INVITE_ACCEPTED: add to collaboratorsConnection
  // - MEMBER_REMOVED: remove from collaboratorsConnection
  // - INVITE_SENT: no cache update (pending invites managed separately)
  //
  const addCollaborator = createAddToParentConnectionUpdater<{ id: string }>(
    'ShoppingList',
    'collaboratorsConnection',
    'ShoppingListCollaborator',
  );
  const removeCollaborator = createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'collaboratorsConnection',
    'ShoppingListCollaborator',
  );

  const collaborationHandlers = subscriptionService.register({
    subscriptionName: 'CollaborationChanges',
    entityType: 'ShoppingListCollaborator',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    entityId: selectedShoppingListId,
    customOnData: (payload: any, client: any) => {
      if (!payload) return;

      // Skip self-echo
      if (payload.userId && userId && payload.userId === userId) {
        if (__DEV__) {
          console.log('⏭️ [CollaborationChanges] Skipping self-echo');
        }
        return;
      }

      const changeType = payload.changeType;
      const collaborator = payload.collaborator;
      const listId = payload.shoppingListId;

      if (!collaborator?.id || !listId) return;

      switch (changeType) {
        case CollaborationChangeType.MemberAdded:
        case CollaborationChangeType.InviteAccepted:
          addCollaborator(client.cache, listId, collaborator);
          break;
        case CollaborationChangeType.MemberRemoved:
          removeCollaborator(client.cache, listId, collaborator.id, { evictItem: true });
          break;
        case CollaborationChangeType.InviteSent:
          // Pending invites are managed separately
          break;
        default:
          break;
      }
    },
  });

  useCollaborationChangesSubscription({
    variables: { shoppingListId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...collaborationHandlers,
  });
}

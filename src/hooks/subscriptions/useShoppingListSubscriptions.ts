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
  ShoppingListItemDisplayFragmentDoc,
  GetShoppingListDocument,
  GetShoppingListQuery,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';
import { MutationType } from '#generated';
import {
  removeFromShoppingListItemsConnection,
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  clearAllPurchasedItemsFromCache,
  addNewItemToShoppingListCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';

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

            // Helper: re-sort edges after sortOrder changes
            const resortEdges = (cache: typeof client.cache) => {
              if (!sortOrderChanged) return;
              try {
                const queryResult = cache.readQuery({
                  query: GetShoppingListDocument,
                  variables: { id: selectedShoppingListId },
                }) as GetShoppingListQuery | null;

                if (queryResult?.shoppingList?.itemsConnection?.edges) {
                  const sortedEdges = [...queryResult.shoppingList.itemsConnection.edges].sort(
                    (a, b) =>
                      (a.node.sortOrder || '').localeCompare(b.node.sortOrder || ''),
                  );

                  cache.writeQuery({
                    query: GetShoppingListDocument,
                    variables: { id: selectedShoppingListId },
                    data: {
                      shoppingList: {
                        ...queryResult.shoppingList,
                        itemsConnection: {
                          ...queryResult.shoppingList.itemsConnection,
                          edges: sortedEdges,
                        },
                      },
                    },
                  });
                }
              } catch (error) {
                console.warn('Failed to re-sort edges after subscription update:', error);
              }
            };

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

              scheduleAnimation(item.id, direction, () => {
                // PERF: Batch move + sort into a single cache notification
                client.cache.batch({
                  update(cache: ApolloCache) {
                    moveOp(cache, selectedShoppingListId, item);
                    resortEdges(cache);
                  },
                });
                scheduleEntryAnimation?.(item.id, direction);
              });
            } else {
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

                  resortEdges(cache);
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

  // Additional shopping list subscriptions can be added here:
  // - MyShoppingListsChanges (for dashboard updates)
  // - etc.
}

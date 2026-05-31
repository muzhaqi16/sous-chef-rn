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

import type { ApolloCache, Reference } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import type { ConnectionData } from '#/apollo/utils/cacheUpdaters';
import { useSelectedShoppingListId } from '#store/useAppStore';
import { useSubscription } from '@apollo/client/react';
import {
  ShoppingListItemChangedDocument,
  ShoppingListUpdatedDocument,
  ShoppingListItemsBatchClearedDocument,
  MyShoppingListsItemChangedDocument,
  MyShoppingListsUpdatedDocument,
  MyShoppingListsStatusChangedDocument,
  type ShoppingListItemChangedSubscription,
  type ShoppingListUpdatedSubscription,
  type ShoppingListItemsBatchClearedSubscription,
  type MyShoppingListsItemChangedSubscription,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  CollaborationChangesDocument,
  type CollaborationChangesSubscription,
} from '#features/shoppingList/graphql/collaboration.generated';
import {
  CollaboratorStatus,
  MutationType,
} from '#/graphql/generated/schemaTypes';
import {
  UseShoppingListSubscriptions_ItemFragmentDoc,
  UseShoppingListSubscriptions_CollaboratorFragmentDoc,
  type UseShoppingListSubscriptions_ItemFragment,
  type UseShoppingListSubscriptions_CollaboratorFragment,
} from './useShoppingListSubscriptions.generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';

type ShoppingListItemChangedPayload =
  ShoppingListItemChangedSubscription['shoppingListItemChanged'];
type ShoppingListUpdatedPayload =
  ShoppingListUpdatedSubscription['shoppingListUpdated'];
type ShoppingListItemsBatchClearedPayload =
  ShoppingListItemsBatchClearedSubscription['shoppingListItemsBatchCleared'];
type MyShoppingListsItemChangedPayload =
  MyShoppingListsItemChangedSubscription['myShoppingListsItemChanged'];
type CollaborationChangesPayload =
  CollaborationChangesSubscription['collaborationChanged'];
import {
  removeFromShoppingListItemsConnection,
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  clearAllPurchasedItemsFromCache,
  addNewItemToShoppingListCache,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { Telemetry } from '#/services/telemetry';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

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
  executeCacheUpdate(() => {
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
              console.log(
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
              console.warn(
                `⚠️ [resortEdges] unexpected storeFieldName format: ${storeFieldName}`,
              );
            }
            console.log(
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

    if (__DEV__) {
      const duration = performance.now() - t0;
      console.log(
        `📊 [resortEdges] duration=${duration.toFixed(
          2,
        )}ms listId=${shoppingListId}`,
      );
      Telemetry.histogram('resort_edges_duration_ms', duration);
    }
  }, 'Failed to re-sort edges after subscription update:');
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
  const selectedShoppingListId = useSelectedShoppingListId() || undefined;

  //
  // Shopping List Changes Subscription (consolidated)
  // Handles all shopping list events based on changeType:
  // - ITEMS_CHANGED: item add/update/delete
  // - LIST_UPDATED: metadata changes
  // - ITEMS_BATCH_CLEARED: batch clear of purchased items
  // - STATUS_CHANGED: status transitions (no-op currently)
  // Note: Collaborator events use the separate collaborationChanged subscription
  //
  const changesHandlers =
    subscriptionService.register<ShoppingListItemChangedPayload>({
      subscriptionName: 'ShoppingListItemChanged',
      entityType: 'ShoppingListItem',
      enableDeduplication: true,
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
      entityId: selectedShoppingListId,
      customOnData: (
        payload: ShoppingListItemChangedPayload,
        client: SubscriptionApolloClient,
      ) => {
        if (__DEV__) {
          console.log(
            `📊 [Subscription] ShoppingListItemChanged: mutation=${payload?.mutation}`,
          );
        }

        if (!payload || !selectedShoppingListId) return;
        if (subscriptionService.isParentDeleting(selectedShoppingListId))
          return;

        const payloadUserId = payload.userId;
        const mutation = payload.mutation;
        const item = payload.item;

        if (!item?.id) {
          console.warn(
            '⚠️ [ShoppingListItemChanged] Received item with no id, skipping cache update',
            { mutation },
          );
          return;
        }

        if (payloadUserId && userId && payloadUserId === userId) {
          if (__DEV__) {
            console.log(
              '⏭️ [Subscription] Skipping self-echo (same user)',
              item.id,
            );
          }
          return;
        }

        if (
          mutation === MutationType.Created ||
          mutation === MutationType.ItemAdded
        ) {
          // PERF: Batch so the internal modify + any follow-up writes coalesce into one notification
          client.cache.batch({
            update(cache: ApolloCache) {
              addNewItemToShoppingListCache(
                cache,
                selectedShoppingListId,
                item,
              );
            },
          });
        } else if (
          mutation === MutationType.Deleted ||
          mutation === MutationType.ItemRemoved
        ) {
          if (scheduleAnimation) {
            scheduleAnimation(item.id, -1, () => {
              // PERF: Batch remove + evict + gc into a single observer notification
              client.cache.batch({
                update(cache: ApolloCache) {
                  removeFromShoppingListItemsConnection(
                    cache,
                    selectedShoppingListId,
                    item.id,
                    {
                      evictItem: true,
                    },
                  );
                },
              });
            });
          } else {
            // PERF: Batch remove + evict + gc into a single observer notification
            client.cache.batch({
              update(cache: ApolloCache) {
                removeFromShoppingListItemsConnection(
                  cache,
                  selectedShoppingListId,
                  item.id,
                  {
                    evictItem: true,
                  },
                );
              },
            });
          }
        } else if (
          mutation === MutationType.ItemUpdated ||
          mutation === MutationType.ItemCompleted ||
          mutation === MutationType.ItemUncompleted
        ) {
          // Materialize the masked ShoppingListItem fragment so we can
          // pass the full fragment shape to cache.writeFragment below.
          // For an Updated/Completed/Uncompleted event the entity is
          // already in the cache (it's being updated), so readFragment
          // returns the merged record.
          const itemData =
            client.cache.readFragment<UseShoppingListSubscriptions_ItemFragment>(
              {
                fragment: UseShoppingListSubscriptions_ItemFragmentDoc,
                fragmentName: 'useShoppingListSubscriptions_item',
                from: { __typename: 'ShoppingListItem', id: item.id },
              },
            );

          const sortOrderChanged = item.sortOrder != null;
          const isCompletedMutation = mutation === MutationType.ItemCompleted;
          const isUncompletedMutation =
            mutation === MutationType.ItemUncompleted;

          if (__DEV__) {
            console.log('🔍 [Subscription Cache Debug]', {
              mutation,
              itemId: item.id,
              isCompletedMutation,
              isUncompletedMutation,
              willMoveItem: isCompletedMutation || isUncompletedMutation,
            });
          }

          if (
            scheduleAnimation &&
            (isCompletedMutation || isUncompletedMutation)
          ) {
            // Animated path: write fragment immediately for visual feedback,
            // then batch the move + sort in the animation callback
            if (itemData) {
              client.cache.writeFragment({
                id: client.cache.identify({
                  __typename: 'ShoppingListItem',
                  id: item.id,
                }),
                fragment: UseShoppingListSubscriptions_ItemFragmentDoc,
                fragmentName: 'useShoppingListSubscriptions_item',
                data: itemData,
              });
            }

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
                if (itemData) {
                  cache.writeFragment({
                    id: cache.identify({
                      __typename: 'ShoppingListItem',
                      id: item.id,
                    }),
                    fragment: UseShoppingListSubscriptions_ItemFragmentDoc,
                    fragmentName: 'useShoppingListSubscriptions_item',
                    data: itemData,
                  });
                }

                if (isCompletedMutation) {
                  moveShoppingListItemToPurchased(
                    cache,
                    selectedShoppingListId,
                    item,
                  );
                } else if (isUncompletedMutation) {
                  moveShoppingListItemToUnpurchased(
                    cache,
                    selectedShoppingListId,
                    item,
                  );
                }

                if (sortOrderChanged) {
                  resortEdges(
                    cache,
                    selectedShoppingListId,
                    nonAnimSortVariant,
                  );
                }
              },
            });
          }
        }
      },
    });

  useSubscription(ShoppingListItemChangedDocument, {
    variables: { listId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...changesHandlers,
  });

  //
  // Shopping List Updated Subscription
  // Metadata-level changes on the active list (name, settings, etc.).
  // Apollo auto-normalizes the returned `node: ShoppingList`, so no
  // custom cache work is needed. The customOnData re-evicts the list
  // entity when our own `subscriptionService.isParentDeleting` flag is set,
  // matching the prior LIST_UPDATED handler's deletion re-eviction path.
  //
  const updatedHandlers =
    subscriptionService.register<ShoppingListUpdatedPayload>({
      subscriptionName: 'ShoppingListUpdated',
      entityType: 'ShoppingList',
      enableDeduplication: true,
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
      entityId: selectedShoppingListId,
      customOnData: (
        payload: ShoppingListUpdatedPayload,
        client: SubscriptionApolloClient,
      ) => {
        if (!payload?.node?.id) return;
        if (subscriptionService.isParentDeleting(payload.node.id)) {
          safeEvict(client.cache, 'ShoppingList', payload.node.id);
        }
      },
    });

  useSubscription(ShoppingListUpdatedDocument, {
    variables: { listId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...updatedHandlers,
  });

  //
  // Shopping List Items Batch Cleared Subscription
  // Fired when a user clears all purchased items from the list. Removes the
  // cleared item entities from cache so they disappear from every variant.
  //
  const batchClearedHandlers =
    subscriptionService.register<ShoppingListItemsBatchClearedPayload>({
      subscriptionName: 'ShoppingListItemsBatchCleared',
      entityType: 'ShoppingListItem',
      enableDeduplication: true,
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
      entityId: selectedShoppingListId,
      customOnData: (
        payload: ShoppingListItemsBatchClearedPayload,
        client: SubscriptionApolloClient,
      ) => {
        if (!payload || !selectedShoppingListId) return;

        if (payload.userId && userId && payload.userId === userId) {
          if (__DEV__) {
            console.log('⏭️ [Subscription] Skipping batch-clear self-echo');
          }
          return;
        }

        const clearedItemIds = payload.clearedItemIds || [];
        clearAllPurchasedItemsFromCache(
          client.cache,
          selectedShoppingListId,
          clearedItemIds,
        );
      },
    });

  useSubscription(ShoppingListItemsBatchClearedDocument, {
    variables: { listId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...batchClearedHandlers,
  });

  //
  // My Shopping Lists Item Changes Subscription
  // Cross-list item events for the current user. Apollo auto-normalizes the
  // ShoppingListItem entity returned in the payload, so no custom handler is
  // needed — fields like quantity, purchaseInfo, sortOrder on the entity
  // merge into all cached views automatically.
  //
  const myListsHandlers =
    subscriptionService.register<MyShoppingListsItemChangedPayload>({
      subscriptionName: 'MyShoppingListsItemChanged',
      entityType: 'ShoppingListItem',
      enableDeduplication: true,
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
    });

  useSubscription(MyShoppingListsItemChangedDocument, {
    skip: !userId,
    ...myListsHandlers,
  });

  //
  // My Shopping Lists Updated + Status Changed
  // Cross-list metadata + status events. Apollo auto-normalizes the
  // ShoppingList entity returned in each payload, so no custom handler is
  // needed — totalItems, completedItems, name, status etc. merge into all
  // cached views automatically.
  //
  const myListsUpdatedHandlers = subscriptionService.register({
    subscriptionName: 'MyShoppingListsUpdated',
    entityType: 'ShoppingList',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
  });

  useSubscription(MyShoppingListsUpdatedDocument, {
    skip: !userId,
    ...myListsUpdatedHandlers,
  });

  const myListsStatusHandlers = subscriptionService.register({
    subscriptionName: 'MyShoppingListsStatusChanged',
    entityType: 'ShoppingList',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
  });

  useSubscription(MyShoppingListsStatusChangedDocument, {
    skip: !userId,
    ...myListsStatusHandlers,
  });

  //
  // Collaboration Changes Subscription
  // Handles collaborator lifecycle for the currently selected shopping list:
  // - CREATED: new invite sent → add to collaboratorsConnection
  // - UPDATED: invite accepted, role changed, or permissions updated →
  //   Apollo auto-normalizes; add to connection if newly active
  // - DELETED: invite declined or collaborator removed → remove from connection
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

  const collaborationHandlers =
    subscriptionService.register<CollaborationChangesPayload>({
      subscriptionName: 'CollaborationChanges',
      entityType: 'ShoppingListCollaborator',
      enableDeduplication: true,
      userId,
      cacheUpdateStrategy: CacheStrategy.NONE,
      enableLogging: true,
      entityId: selectedShoppingListId,
      customOnData: (
        payload: CollaborationChangesPayload,
        client: SubscriptionApolloClient,
      ) => {
        if (!payload) return;

        // Skip self-echo
        if (payload.userId && userId && payload.userId === userId) {
          if (__DEV__) {
            console.log('⏭️ [CollaborationChanges] Skipping self-echo');
          }
          return;
        }

        const mutation = payload.mutation;
        const collaboratorRef = payload.collaborator;
        const listId = payload.listId;

        if (!collaboratorRef || !listId) return;

        // Materialize the masked ShoppingListCollaborator fragment so we can
        // read `id` (cache lookup) and `status` (for the Active branch).
        const collaborator =
          client.cache.readFragment<UseShoppingListSubscriptions_CollaboratorFragment>(
            {
              fragment: UseShoppingListSubscriptions_CollaboratorFragmentDoc,
              fragmentName: 'useShoppingListSubscriptions_collaborator',
              from: collaboratorRef,
            },
          );

        if (!collaborator?.id) return;

        switch (mutation) {
          case MutationType.Created:
            // New invite sent or collaborator added
            addCollaborator(client.cache, listId, collaborator);
            break;
          case MutationType.Updated:
            // Invite accepted, role changed, or permissions updated.
            // Apollo auto-normalizes the collaborator entity by id,
            // so role/permission changes merge automatically.
            // If the collaborator just became ACTIVE (invite accepted),
            // ensure they're in the connection.
            if (collaborator.status === CollaboratorStatus.Active) {
              addCollaborator(client.cache, listId, collaborator);
            }
            break;
          case MutationType.Deleted:
            // Invite declined or collaborator removed
            removeCollaborator(client.cache, listId, collaborator.id, {
              evictItem: true,
            });
            break;
          default:
            break;
        }
      },
    });

  useSubscription(CollaborationChangesDocument, {
    variables: { listId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...collaborationHandlers,
  });
}

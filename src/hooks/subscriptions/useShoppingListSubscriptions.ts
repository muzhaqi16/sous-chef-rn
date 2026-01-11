/**
 * Shopping List Subscriptions
 *
 * Centralizes all shopping list-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Shopping list items (add/update/delete) - uses custom handler for itemsConnection
 * - Shopping list metadata (name, status, budget, totals)
 * - Collaborators (add/remove)
 *
 * These subscriptions automatically update the Apollo cache and provide
 * deduplication to prevent self-echo and duplicate updates.
 */

import { useStore } from '#store';
import {
  useShoppingListItemsChangedSubscription,
  useShoppingListUpdatedSubscription,
  useShoppingListCollaboratorsChangedSubscription,
  ShoppingListItemFragmentDoc,
  ShoppingListItemDisplayFragmentDoc,
  GetShoppingListDocument,
  GetShoppingListQuery,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions';
import { CacheStrategy, MutationType } from '#/services/subscriptions/types';
import {
  addToShoppingListItemsConnection,
  removeFromShoppingListItemsConnection,
  addToUnpurchasedItems,
  removeFromUnpurchasedItems,
  addToPurchasedItems,
  removeFromPurchasedItems,
} from '#/apollo/utils';

/**
 * Initialize shopping list subscriptions for the current user
 *
 * This hook should be called once at the app level (in SubscriptionProvider)
 * It automatically subscribes to relevant shopping list changes based on
 * the user's selected shopping list.
 *
 * @param userId - Current user ID for deduplication
 */
export function useShoppingListSubscriptions(userId?: string) {
  // Get selected shopping list from global store
  // This allows subscriptions to follow the user's current context
  const selectedShoppingListId = useStore(state => state.selectedShoppingListId) || undefined;

  //
  // Shopping List Items Changed Subscription
  // Handles CREATE/UPDATE/DELETE operations on shopping list items
  // Uses custom handler for ShoppingList.itemsConnection cache updates
  //
  const itemsHandlers = subscriptionService.register({
    subscriptionName: 'ShoppingListItemsChanged',
    entityType: 'ShoppingListItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Disable default - using custom handler for connection pattern
    enableLogging: true,
    entityId: selectedShoppingListId,
    // Custom handler for itemsConnection updates
    // payload IS shoppingListItemsChanged (already extracted by SubscriptionService)
    customOnData: (payload: any, client: any) => {
      if (!payload || !selectedShoppingListId) return;

      const mutation = payload.mutation;
      const item = payload.item;

      if (!item) return;

      if (mutation === MutationType.CREATE || mutation === MutationType.ITEM_ADDED) {
        // Add new item to ShoppingList.itemsConnection
        addToShoppingListItemsConnection(client.cache, selectedShoppingListId, item);
      } else if (mutation === MutationType.DELETE || mutation === MutationType.ITEM_REMOVED) {
        // Remove item from ShoppingList.itemsConnection
        removeFromShoppingListItemsConnection(client.cache, selectedShoppingListId, item.id, {
          evictItem: true,
        });
      } else if (mutation === 'ITEM_UPDATED' || mutation === MutationType.ITEM_COMPLETED || mutation === MutationType.ITEM_UNCOMPLETED) {
        // Read old item to detect sortOrder changes (needed for re-sorting)
        // Use ShoppingListItemDisplayFragment because that's what GetShoppingListItemsPaginated uses
        const oldItem = client.cache.readFragment({
          id: client.cache.identify({ __typename: 'ShoppingListItem', id: item.id }),
          fragment: ShoppingListItemDisplayFragmentDoc,
          fragmentName: 'ShoppingListItemDisplayFragment',
        }) as { sortOrder?: string | null } | null;

        const sortOrderChanged = oldItem?.sortOrder !== item.sortOrder;

        // Write updated item data to cache using fragment
        // This handles quantity, sortOrder, purchaseInfo, and all other field updates
        client.cache.writeFragment({
          id: client.cache.identify({ __typename: 'ShoppingListItem', id: item.id }),
          fragment: ShoppingListItemFragmentDoc,
          fragmentName: 'ShoppingListItemFragment',
          data: item,
        });

        // Use mutation type to determine cache operations (aligns with usePantrySubscriptions.ts pattern)
        // Apollo auto-normalizes subscription data BEFORE onData runs, so comparing old vs new
        // values doesn't work - both will show the same value. Use mutation type instead.
        const isCompletedMutation = mutation === MutationType.ITEM_COMPLETED;
        const isUncompletedMutation = mutation === MutationType.ITEM_UNCOMPLETED;

        // Debug logging for subscription cache updates
        console.log('🔍 [Subscription Cache Debug]', {
          mutation,
          itemId: item.id,
          isCompletedMutation,
          isUncompletedMutation,
          willMoveItem: isCompletedMutation || isUncompletedMutation,
        });

        if (isCompletedMutation || isUncompletedMutation) {
          // Update itemsConnection field (used by GetShoppingListQuery)
          client.cache.modify({
            id: client.cache.identify({ __typename: 'ShoppingList', id: selectedShoppingListId }),
            fields: {
              itemsConnection(existing: any, { readField, storeFieldName, toReference }: any) {
                const isUnpurchasedConnection = storeFieldName.includes('isPurchased":false');
                const isPurchasedConnection = storeFieldName.includes('isPurchased":true');

                if (!existing?.edges) return existing;

                if (isCompletedMutation) {
                  // Moving to purchased: remove from unpurchased, add to purchased
                  if (isUnpurchasedConnection) {
                    return {
                      ...existing,
                      edges: existing.edges.filter(
                        (edge: any) => readField('id', edge.node) !== item.id,
                      ),
                      totalCount: Math.max(0, (existing.totalCount || 0) - 1),
                    };
                  }
                  if (isPurchasedConnection) {
                    const alreadyExists = existing.edges.some(
                      (edge: any) => readField('id', edge.node) === item.id,
                    );
                    if (alreadyExists) return existing;
                    return {
                      ...existing,
                      edges: [
                        {
                          __typename: 'ShoppingListItemEdge',
                          cursor: item.id,
                          node: toReference({ __typename: 'ShoppingListItem', id: item.id }),
                        },
                        ...existing.edges,
                      ],
                      totalCount: (existing.totalCount || 0) + 1,
                    };
                  }
                } else {
                  // Moving to unpurchased: remove from purchased, add to unpurchased
                  if (isPurchasedConnection) {
                    return {
                      ...existing,
                      edges: existing.edges.filter(
                        (edge: any) => readField('id', edge.node) !== item.id,
                      ),
                      totalCount: Math.max(0, (existing.totalCount || 0) - 1),
                    };
                  }
                  if (isUnpurchasedConnection) {
                    const alreadyExists = existing.edges.some(
                      (edge: any) => readField('id', edge.node) === item.id,
                    );
                    if (alreadyExists) return existing;
                    return {
                      ...existing,
                      edges: [
                        {
                          __typename: 'ShoppingListItemEdge',
                          cursor: item.id,
                          node: toReference({ __typename: 'ShoppingListItem', id: item.id }),
                        },
                        ...existing.edges,
                      ],
                      totalCount: (existing.totalCount || 0) + 1,
                    };
                  }
                }

                return existing;
              },
            },
          });

          // Also update aliased fields used by GetShoppingListItemsPaginatedQuery
          // This query uses aliases: unpurchasedItems/purchasedItems instead of itemsConnection
          // Apollo caches aliased fields separately, so we must update them explicitly
          if (isCompletedMutation) {
            // Moving to purchased: remove from unpurchased, add to purchased
            removeFromUnpurchasedItems(client.cache, selectedShoppingListId, item.id);
            addToPurchasedItems(client.cache, selectedShoppingListId, item);
          } else {
            // Moving to unpurchased: remove from purchased, add to unpurchased
            removeFromPurchasedItems(client.cache, selectedShoppingListId, item.id);
            addToUnpurchasedItems(client.cache, selectedShoppingListId, item);
          }
        }

        // Re-sort itemsConnection edges if sortOrder changed
        // This ensures multi-client sync: when one client reorders, others see the new order
        if (sortOrderChanged) {
          try {
            const queryResult = client.cache.readQuery({
              query: GetShoppingListDocument,
              variables: { id: selectedShoppingListId },
            }) as GetShoppingListQuery | null;

            if (queryResult?.shoppingList?.itemsConnection?.edges) {
              // Sort edges by sortOrder (localeCompare matches base62 ordering)
              const sortedEdges = [...queryResult.shoppingList.itemsConnection.edges].sort(
                (a, b) =>
                  (a.node.sortOrder || '').localeCompare(b.node.sortOrder || ''),
              );

              client.cache.writeQuery({
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
        }
      }
    },
  });

  useShoppingListItemsChangedSubscription({
    variables: { listId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...itemsHandlers,
  });

  //
  // Shopping List Updated Subscription
  // Handles metadata changes (name, status, budget, item counts, totals)
  //
  const metadataHandlers = subscriptionService.register({
    subscriptionName: 'ShoppingListUpdated',
    entityType: 'ShoppingList',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC, // Apollo handles metadata updates
    enableLogging: true,
    entityId: selectedShoppingListId,
  });

  useShoppingListUpdatedSubscription({
    variables: { listId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...metadataHandlers,
  });

  //
  // Shopping List Collaborators Changed Subscription
  // Handles collaborator add/remove/update operations
  //
  const collaboratorsHandlers = subscriptionService.register({
    subscriptionName: 'ShoppingListCollaboratorsChanged',
    entityType: 'ShoppingListCollaborator',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
    enableLogging: true,
    entityId: selectedShoppingListId,
  });

  useShoppingListCollaboratorsChangedSubscription({
    variables: { listId: selectedShoppingListId! },
    skip: !selectedShoppingListId,
    ...collaboratorsHandlers,
  });

  // Additional shopping list subscriptions can be added here:
  // - ShoppingListStatusChanged
  // - etc.
}

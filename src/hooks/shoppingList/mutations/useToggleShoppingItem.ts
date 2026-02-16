/**
 * useToggleShoppingItem - Toggle purchase status mutation for shopping list
 *
 * Single responsibility:
 * - Toggle mutation with optimistic response
 * - Move items between purchased/unpurchased connections
 * - Persist optimistic state for offline support
 */

import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useToggleShoppingListItemPurchasedMutation,
  ShoppingListItemDisplayFragmentDoc,
} from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  addToUnpurchasedItems,
  removeFromUnpurchasedItems,
  addToPurchasedItems,
  removeFromPurchasedItems,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { isNetworkError } from './utils';

interface UseToggleShoppingItemOptions {
  listId: string | null | undefined;
  itemsRef: React.RefObject<ShoppingListItemDisplayFragment[]>;
  refetch: () => Promise<any>;
}

/**
 * Hook for toggling the purchased status of shopping list items
 *
 * Handles:
 * - Optimistic UI updates
 * - Moving items between purchased/unpurchased connections
 * - Offline persistence of optimistic state
 * - Network error handling (queue for retry)
 *
 * @example
 * ```tsx
 * const { toggleItem } = useToggleShoppingItem({ listId, items, refetch });
 * await toggleItem('item-123');
 * ```
 */
export function useToggleShoppingItem({ listId, itemsRef, refetch }: UseToggleShoppingItemOptions) {
  const { handleApolloError } = useErrorHandler();

  const [togglePurchasedMutation] = useToggleShoppingListItemPurchasedMutation({
    errorPolicy: 'all',
    // Optimistic response ensures update() runs immediately (not after network response)
    optimisticResponse: variables => {
      const item = itemsRef.current?.find(i => i.id === variables.id);
      return {
        __typename: 'Mutation',
        toggleShoppingListItemPurchased: {
          __typename: 'ShoppingListItemPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          shoppingListItem: {
            __typename: 'ShoppingListItem',
            id: variables.id,
            itemName: item?.itemName ?? null,
            quantity: item?.quantity ?? null,
            quantityInput: item?.quantityInput ?? null,
            normalizedQuantity: null,
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: variables.purchased,
              purchasedQuantity: null,
              purchasedPrice: null,
              purchaseDate: variables.purchased ? new Date().toISOString() : null,
            },
            updatedAt: new Date().toISOString(),
            version: item?.version ?? 0,
            category: item?.category ?? null,
            unitName: item?.unitName ?? null,
            unit: item?.unit ?? null,
          },
        },
      };
    },
    update(cache, _result, { variables }) {
      if (!variables || !listId) return;

      const itemId = variables.id;
      const newStatus = variables.purchased; // true = marking purchased, false = marking unpurchased

      // 1. Update the item's purchaseInfo field directly
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fields: {
          purchaseInfo(existingPurchaseInfo = {}) {
            return {
              ...existingPurchaseInfo,
              isPurchased: newStatus,
            };
          },
          updatedAt() {
            return new Date().toISOString();
          },
        },
      });

      // 2. Move item between connections using cache.modify on ShoppingList entity
      // This is the PREFERRED pattern per docs/apollo-client-patterns.md
      // With keyArgs: ['filters'], Apollo stores separate connection variants
      // The itemsConnection modifier is called for EACH variant (unpurchased/purchased)
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingList', id: listId }),
        fields: {
          itemsConnection(existing: any, { readField, storeFieldName, toReference }) {
            // Determine which connection variant we're modifying based on storeFieldName
            // storeFieldName contains the serialized keyArgs, e.g., 'itemsConnection({"filters":{"isPurchased":false}})'
            const isUnpurchasedConnection = storeFieldName.includes('isPurchased":false');
            const isPurchasedConnection = storeFieldName.includes('isPurchased":true');

            if (!existing?.edges) return existing;

            if (newStatus) {
              // Marking as purchased: remove from unpurchased, add to purchased
              if (isUnpurchasedConnection) {
                // Filter out the item AND any broken edges with missing node IDs
                const filteredEdges = existing.edges.filter((edge: any) => {
                  const nodeId = readField('id', edge?.node);
                  return nodeId !== undefined && nodeId !== null && nodeId !== itemId;
                });
                return {
                  ...existing,
                  edges: filteredEdges,
                  totalCount: Math.max(0, (existing.totalCount || 0) - 1),
                };
              }
              if (isPurchasedConnection) {
                // Check for duplicates, handling undefined node IDs
                const alreadyExists = existing.edges.some((edge: any) => {
                  const nodeId = readField('id', edge?.node);
                  return nodeId === itemId;
                });
                if (alreadyExists) return existing;
                return {
                  ...existing,
                  edges: [
                    {
                      __typename: 'ShoppingListItemEdge',
                      cursor: itemId,
                      node: toReference({ __typename: 'ShoppingListItem', id: itemId }),
                    },
                    ...existing.edges,
                  ],
                  totalCount: (existing.totalCount || 0) + 1,
                };
              }
            } else {
              // Marking as unpurchased: remove from purchased, add to unpurchased
              if (isPurchasedConnection) {
                // Filter out the item AND any broken edges with missing node IDs
                const filteredEdges = existing.edges.filter((edge: any) => {
                  const nodeId = readField('id', edge?.node);
                  return nodeId !== undefined && nodeId !== null && nodeId !== itemId;
                });
                return {
                  ...existing,
                  edges: filteredEdges,
                  totalCount: Math.max(0, (existing.totalCount || 0) - 1),
                };
              }
              if (isUnpurchasedConnection) {
                // Check for duplicates, handling undefined node IDs
                const alreadyExists = existing.edges.some((edge: any) => {
                  const nodeId = readField('id', edge?.node);
                  return nodeId === itemId;
                });
                if (alreadyExists) return existing;
                return {
                  ...existing,
                  edges: [
                    {
                      __typename: 'ShoppingListItemEdge',
                      cursor: itemId,
                      node: toReference({ __typename: 'ShoppingListItem', id: itemId }),
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

      // 2b. Also update aliased fields used by GetShoppingListItemsPaginatedQuery
      // This query uses aliases: unpurchasedItems/purchasedItems instead of itemsConnection
      // Apollo caches aliased fields separately, so we must update them explicitly

      // Get the full item data from the items ref (avoids stale closure) - this is more reliable than
      // cache.readFragment which can return null during optimistic updates
      const itemFromArray = itemsRef.current?.find(i => i.id === itemId);

      // Fallback to cache read if not found in array (edge case)
      const fullItem = itemFromArray || cache.readFragment<ShoppingListItemDisplayFragment>({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fragment: ShoppingListItemDisplayFragmentDoc,
        fragmentName: 'ShoppingListItemDisplayFragment',
      });

      // Only proceed if we have valid item data to prevent ghost/empty items
      if (!fullItem || !fullItem.itemName) {
        console.warn('⚠️ Toggle purchase: Item data missing, skipping aliased field update for', itemId);
        return;
      }

      if (newStatus) {
        // Moving to purchased: remove from unpurchased, add to purchased
        removeFromUnpurchasedItems(cache, listId, itemId);
        addToPurchasedItems(cache, listId, fullItem);
      } else {
        // Moving to unpurchased: remove from purchased, add to unpurchased
        removeFromPurchasedItems(cache, listId, itemId);
        addToUnpurchasedItems(cache, listId, fullItem);
      }

      // 3. Persist optimistic isPurchased to survive app restarts while offline
      optimisticDataPersistence.save(
        'ShoppingListItem',
        itemId,
        'isPurchased',
        newStatus,
      );
    },
    onCompleted: data => {
      // Clear persisted optimistic data on successful server sync
      const item = data?.toggleShoppingListItemPurchased?.shoppingListItem;
      if (item?.id) {
        optimisticDataPersistence.clear(
          'ShoppingListItem',
          item.id,
          'isPurchased',
        );
      }
    },
    onError: error => {
      // For network errors, don't show alert or refetch - queue will handle retry
      // This keeps the optimistic UI intact while offline
      if (isNetworkError(error)) {
        console.log('Toggle purchase queued for retry (network error)');
        return;
      }

      // For server/validation errors, show alert and refetch to restore correct state
      const { message } = handleApolloError(error, {
        operation: 'Toggle Item Purchased',
      });
      Alert.alert('Error', message);
      refetch();
    },
  });

  // Simplified toggleItem - uses items ref instead of cache read
  const toggleItem = useCallback(
    async (itemId: string) => {
      if (!listId) return false;

      try {
        const item = itemsRef.current?.find(i => i.id === itemId);
        if (!item) return false;

        const newStatus = !item.purchaseInfo?.isPurchased;

        const result = await togglePurchasedMutation({
          variables: { id: itemId, purchased: newStatus },
        });

        return result.data?.toggleShoppingListItemPurchased?.shoppingListItem ?? false;
      } catch (error) {
        console.error('Toggle shopping list item purchased error:', error);
        return false;
      }
    },
    [listId, itemsRef, togglePurchasedMutation],
  );

  return { toggleItem };
}

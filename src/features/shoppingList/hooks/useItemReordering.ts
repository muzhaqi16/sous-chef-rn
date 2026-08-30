import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ModifierDetails } from '@apollo/client/cache';
import type { Reference } from '@apollo/client/utilities';
import { MoveShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseItemReordering_ServerItemFragmentDoc,
  type UseItemReordering_ServerItemFragment,
} from './useItemReordering.generated';
import { generateKeyBetween } from 'fractional-indexing';
import { SubscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { isUnpurchasedVariant } from '#/apollo/utils/shoppingListCacheUpdaters';
import { logger } from '#/utils/environment';

interface ShoppingListItem {
  id: string;
  sortOrder?: string | null;
  version: number;
  [key: string]: unknown;
}

interface UseItemReorderingOptions<T extends ShoppingListItem> {
  listId?: string;
  items: T[];
  /** Recovers from a version conflict. */
  refetch?: () => void;
}

/**
 * Optimistic reordering by fractional index: the new sortOrder is written to the
 * cache before the mutation fires, and reverted from persistence on failure.
 */
export function useItemReordering<T extends ShoppingListItem>(
  options: UseItemReorderingOptions<T>,
) {
  const { listId, items, refetch } = options;
  const client = useApolloClient();

  const [moveItem] = useMutation(MoveShoppingListItemDocument, {
    // No optimisticResponse and no update callback: cache.modify runs BEFORE the
    // mutation call for immediate feedback.
  });

  /**
   * `afterItemId` is the neighbour that ends up before the new position,
   * `beforeItemId` the one after it; either may be null at a list edge.
   */
  const handleSortOrderUpdate = async (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => {
    if (!listId) return;

    const currentItem = items.find(item => item.id === itemId);
    if (!currentItem) {
      logger.error('Item not found in cache:', itemId);
      return;
    }

    const afterItem = afterItemId
      ? items.find(i => i.id === afterItemId)
      : null;
    const beforeItem = beforeItemId
      ? items.find(i => i.id === beforeItemId)
      : null;

    // after > before means the visual order and sortOrder order disagree, i.e.
    // the cache is out of sync.
    let newSortOrder: string | undefined;

    if (afterItem?.sortOrder && beforeItem?.sortOrder) {
      if (afterItem.sortOrder > beforeItem.sortOrder) {
        logger.warn('Invalid sortOrder state (after > before), refetching...', {
          afterId: afterItemId,
          afterSortOrder: afterItem.sortOrder,
          beforeId: beforeItemId,
          beforeSortOrder: beforeItem.sortOrder,
        });
        refetch?.();
        return;
      }

      if (afterItem.sortOrder === beforeItem.sortOrder) {
        // Nothing can be inserted between two identical values, so fall back to
        // inserting after the duplicate block.
        logger.warn(
          'Duplicate sortOrder in cache, using fallback positioning',
          {
            afterId: afterItemId,
            beforeId: beforeItemId,
            sharedSortOrder: afterItem.sortOrder,
          },
        );

        const nextItem = items
          .filter(i => i.sortOrder && i.sortOrder > afterItem.sortOrder!)
          .sort((a, b) =>
            (a.sortOrder || '').localeCompare(b.sortOrder || ''),
          )[0];

        newSortOrder = generateKeyBetween(
          afterItem.sortOrder,
          nextItem?.sortOrder ?? null,
        );
      }
    }

    if (!newSortOrder) {
      newSortOrder = generateKeyBetween(
        afterItem?.sortOrder ?? null,
        beforeItem?.sortOrder ?? null,
      );
    }

    // Batched so FlashList sees one consistent state instead of two renders.
    client.cache.batch({
      update: cache => {
        cache.modify({
          id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
          fields: {
            sortOrder() {
              return newSortOrder;
            },
            updatedAt() {
              return new Date().toISOString();
            },
          },
        });

        const sortEdges = (
          edges: readonly Reference[],
          readField: ModifierDetails['readField'],
        ) => {
          return [...edges].sort((a, b) => {
            const nodeA = readField<Reference>('node', a);
            const nodeB = readField<Reference>('node', b);
            const sortA =
              (nodeA ? readField<string>('sortOrder', nodeA) : '') ?? '';
            const sortB =
              (nodeB ? readField<string>('sortOrder', nodeB) : '') ?? '';
            if (sortA < sortB) return -1;
            if (sortA > sortB) return 1;
            // Secondary sort by id for deterministic ordering when sortOrder matches
            const idA = (nodeA ? readField<string>('id', nodeA) : '') ?? '';
            const idB = (nodeB ? readField<string>('id', nodeB) : '') ?? '';
            return idA.localeCompare(idB);
          });
        };

        // Re-sort the connection's edges so FlashList sees the new order.
        // cache.modify, not writeQuery: an aliased writeQuery does not match the
        // field policy's `keyArgs: ['filters']` cache key.
        cache.modify({
          id: cache.identify({ __typename: 'ShoppingList', id: listId }),
          fields: {
            itemsConnection(existing, { storeFieldName, readField }) {
              // cache.modify runs for every cached variant; only the unpurchased
              // one is ordered by sortOrder.
              if (!isUnpurchasedVariant(storeFieldName)) {
                return existing;
              }

              return {
                ...existing,
                edges: sortEdges(existing?.edges || [], readField),
              };
            },
          },
        });
      },
    });

    // Survives cache-and-network refetches while offline.
    optimisticDataPersistence.save(
      'ShoppingListItem',
      itemId,
      'sortOrder',
      newSortOrder,
    );

    const moveAfterItemId = afterItemId ?? undefined;
    const moveBeforeItemId = beforeItemId ?? undefined;
    let result;
    try {
      result = await moveItem({
        variables: {
          input: {
            itemId,
            afterItemId: moveAfterItemId,
            beforeItemId: moveBeforeItemId,
          },
        },
        // Local-first: queue on an API-down-while-online failure (moves are
        // coalesced latest-wins on replay via SyncMoveShoppingListItem).
        context: { localFirst: true },
      });
    } catch (error) {
      handleMutationError(error, {
        operation: 'Move Item',
        checks: [versionConflictCheck({ onRefresh: () => refetch?.() })],
      });
    }
    if (!result) {
      // Drop the persisted sortOrder — it carries no version, so the restoration
      // hook would re-apply the failed move on every cold start.
      optimisticDataPersistence.clear('ShoppingListItem', itemId, 'sortOrder');
      return;
    }

    // errorPolicy: 'all' — a failing mutation resolves rather than throwing.
    if (result.error) {
      handleMutationError(result.error, {
        operation: 'Move Item',
        checks: [versionConflictCheck({ onRefresh: () => refetch?.() })],
      });
      optimisticDataPersistence.clear('ShoppingListItem', itemId, 'sortOrder');
      refetch?.();
      return;
    }

    // serverItem is a masked ref — materialize it through a narrow fragment
    // selecting only what is read here (version, sortOrder).
    const serverItemRef =
      result.data?.moveShoppingListItem?.__typename ===
      'MoveShoppingListItemPayload'
        ? result.data.moveShoppingListItem.shoppingListItem
        : null;
    const serverItem = serverItemRef
      ? client.cache.readFragment<UseItemReordering_ServerItemFragment>({
          fragment: UseItemReordering_ServerItemFragmentDoc,
          fragmentName: 'useItemReordering_serverItem',
          from: serverItemRef,
        })
      : null;
    const serverVersion = serverItem?.version;
    const serverSortOrder = serverItem?.sortOrder;
    const originalVersion = currentItem.version;

    // Server confirmed, so the persisted value has nothing left to restore.
    optimisticDataPersistence.clear('ShoppingListItem', itemId, 'sortOrder');

    if (serverVersion === originalVersion) {
      // Unchanged version means the item was already in position.
      logger.debug('⊘ Move was no-op (item already in position):', {
        itemId,
        version: serverVersion,
      });
      return;
    }

    logger.debug('✓ Sort order updated on server:', {
      itemId,
      serverSortOrder,
      oldVersion: originalVersion,
      newVersion: serverVersion,
    });

    // The server may compute a different sortOrder than the optimistic one.
    if (serverSortOrder && serverSortOrder !== newSortOrder) {
      logger.debug('Server returned different sortOrder, updating cache:', {
        optimistic: newSortOrder,
        server: serverSortOrder,
      });
      client.cache.modify({
        id: client.cache.identify({
          __typename: 'ShoppingListItem',
          id: itemId,
        }),
        fields: {
          sortOrder() {
            return serverSortOrder;
          },
        },
      });
    }

    // Mark this item as recently reordered to ignore subscription echo
    SubscriptionService.getInstance().markItemReordered(itemId);
  };

  return { handleSortOrderUpdate };
}

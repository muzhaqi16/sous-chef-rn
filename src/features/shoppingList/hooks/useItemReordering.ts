import { useApolloClient, useMutation } from '@apollo/client/react';
import { MoveShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseItemReordering_ServerItemFragmentDoc,
  type UseItemReordering_ServerItemFragment,
} from './useItemReordering.generated';
import { generateKeyBetween } from 'fractional-indexing';
import { SubscriptionService } from '#/services/subscriptions/SubscriptionService';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import type { ReorderRowInputs } from '#features/shoppingList/offline/localWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
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

// Code-point order, as the server's COLLATE "C" ranks the keys; a locale
// comparison puts "aZ" after "az".
function bySortOrderCodePoint(
  a: { sortOrder?: string | null },
  b: { sortOrder?: string | null },
): number {
  const left = a.sortOrder ?? '';
  const right = b.sortOrder ?? '';
  if (left < right) return -1;
  return left > right ? 1 : 0;
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
  const { t } = useTranslation();

  const [moveItem] = useMutation(MoveShoppingListItemDocument, {
    // Moves coalesce latest-wins on replay via SyncMoveShoppingListItem.
    context: { localFirst: true },
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
    let duplicateBlockSortOrder: string | undefined;

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

        const sharedSortOrder = afterItem.sortOrder;
        const [nextItem] = items
          .filter(i => i.sortOrder && i.sortOrder > sharedSortOrder)
          .sort(bySortOrderCodePoint);

        duplicateBlockSortOrder = generateKeyBetween(
          afterItem.sortOrder,
          nextItem?.sortOrder ?? null,
        );
      }
    }

    const newSortOrder =
      duplicateBlockSortOrder ??
      generateKeyBetween(
        afterItem?.sortOrder ?? null,
        beforeItem?.sortOrder ?? null,
      );

    const inputs: ReorderRowInputs = {
      listId,
      sortOrder: newSortOrder,
      now: new Date().toISOString(),
    };
    const settled = await pendingWritesOf(client.cache).send(
      MoveShoppingListItemDocument,
      {
        input: {
          id: itemId,
          afterItemId: afterItemId ?? undefined,
          beforeItemId: beforeItemId ?? undefined,
        },
      },
      write =>
        settleMutation(() => moveItem(write), {
          document: MoveShoppingListItemDocument,
          fallback: t('errors.updateShoppingItemFailed'),
        }),
      inputs,
    );
    // Queued offline, the local order stands until the replay lands.
    if (settled.status !== 'applied') return;

    // serverItem is a masked ref — materialize it through a narrow fragment
    // selecting only what is read here (version, sortOrder).
    const serverItemRef = appliedPayload(settled.data)?.shoppingListItem;
    const serverItem = serverItemRef
      ? client.cache.readFragment<UseItemReordering_ServerItemFragment>({
          fragment: UseItemReordering_ServerItemFragmentDoc,
          fragmentName: 'useItemReordering_serverItem',
          from: serverItemRef,
          optimistic: true,
        })
      : null;
    const serverVersion = serverItem?.version;
    const serverSortOrder = serverItem?.sortOrder;
    const originalVersion = currentItem.version;

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

    // Mark this item as recently reordered to ignore subscription echo
    SubscriptionService.getInstance().markItemReordered(itemId);
  };

  return { handleSortOrderUpdate };
}

/**
 * Local-first: the item is evicted and the list stats decremented in the cache
 * PERMANENTLY before firing — an `optimisticResponse` rolls back on the offline
 * queue's null result. The replay is idempotent by item id; on a refusal the
 * item still exists server-side, so a refetch restores it.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveItemFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { readListCounters } from '#features/shoppingList/cache/connections';
import { UseRemoveShoppingItem_PurchaseFragmentDoc } from './useRemoveShoppingItem.generated';
import { removeFromShoppingListItemsCache } from './utils';
import { settleShoppingItemDelete } from '#features/shoppingList/offline/replayReconcilers';
import { errorService } from '#/services/errorService';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import type { ShoppingList } from '#/graphql/generated/schemaTypes';

type ListStat = keyof Pick<
  ShoppingList,
  'totalItems' | 'completedItems' | 'remainingItems' | 'completionRate'
>;
type ListStats = Partial<Record<ListStat, number>>;

const LIST_STATS: ListStat[] = [
  'totalItems',
  'completedItems',
  'remainingItems',
  'completionRate',
];

/**
 * The list's counters without one row: a held count moves, a derived one is
 * written only from held inputs, and a count the cache lacks stays absent.
 */
function statsWithoutRow(
  stats: ListStats | null,
  wasPurchased: boolean,
): Partial<Record<ListStat, () => number>> {
  const next: ListStats = {};
  if (stats?.totalItems !== undefined) {
    next.totalItems = Math.max(0, stats.totalItems - 1);
  }
  if (stats?.completedItems !== undefined) {
    next.completedItems = wasPurchased
      ? Math.max(0, stats.completedItems - 1)
      : stats.completedItems;
  }
  const { totalItems, completedItems } = next;
  if (totalItems !== undefined && completedItems !== undefined) {
    next.remainingItems = Math.max(0, totalItems - completedItems);
    next.completionRate = totalItems > 0 ? completedItems / totalItems : 0;
  }
  const fields: Partial<Record<ListStat, () => number>> = {};
  for (const field of LIST_STATS) {
    const value = next[field];
    if (value !== undefined) fields[field] = () => value;
  }
  return fields;
}

/** Writes each stat the snapshot held back as it was. */
function statsAsBefore(
  stats: ListStats | null,
): Partial<Record<ListStat, () => number>> {
  const fields: Partial<Record<ListStat, () => number>> = {};
  for (const field of LIST_STATS) {
    const value = stats?.[field];
    if (value !== undefined) fields[field] = () => value;
  }
  return fields;
}

interface UseRemoveShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

interface UseRemoveShoppingItemReturn {
  /** `true` once the row is gone or its removal is queued; `false` when refused. */
  removeItem: (itemId: string) => Promise<boolean>;
}

export function useRemoveShoppingItem({
  listId,
  refetch,
}: UseRemoveShoppingItemOptions): UseRemoveShoppingItemReturn {
  const client = useApolloClient();
  const { t } = useTranslation();

  const [removeItemMutation] = useMutation(RemoveItemFromShoppingListDocument, {
    context: { localFirst: true },
    update(cache, { data }, { variables }) {
      if (!appliedPayload(data) || !variables) return;
      settleShoppingItemDelete(cache, variables, data);
    },
  });

  const removeItem = async (itemId: string): Promise<boolean> => {
    if (!listId) return false;

    // Snapshot stats + purchased state to compute the decremented aggregates.
    const listCacheId = client.cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });
    const listStats = listCacheId
      ? readListCounters(client.cache, listCacheId)
      : null;
    const itemPurchase = client.cache.readFragment({
      id: client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      }),
      fragment: UseRemoveShoppingItem_PurchaseFragmentDoc,
    });

    // Resolved before the try: value blocks inside one bail the React Compiler.
    const nextStats = statsWithoutRow(
      listStats,
      itemPurchase?.purchaseInfo.isPurchased ?? false,
    );

    try {
      removeFromShoppingListItemsCache(client.cache, listId, itemId, {
        evictItem: true,
      });
      client.cache.modify({ id: listCacheId, fields: nextStats });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Remove Shopping List Item (optimistic evict + stats)',
      });
    }

    const settled = await settleMutation(
      () =>
        removeItemMutation({
          variables: { input: { id: itemId } },
        }),
      {
        document: RemoveItemFromShoppingListDocument,
        fallback: t('errors.deleteItemFailed'),
        removal: true,
        // The item still exists server-side. The refetch brings the row back,
        // but its selection carries no counters, so those come from the snapshot.
        onFailed: () => {
          client.cache.modify({
            id: listCacheId,
            fields: statsAsBefore(listStats),
          });
          void refetch().catch(error =>
            errorService.reportError(error, {
              operation: 'RemoveShoppingItem.refetch',
            }),
          );
        },
      },
    );
    return settled.status !== 'failed';
  };

  return { removeItem };
}

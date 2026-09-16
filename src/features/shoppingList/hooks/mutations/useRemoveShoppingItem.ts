/**
 * Local-first: the item is evicted and the list stats decremented in the cache
 * PERMANENTLY before firing — an `optimisticResponse` rolls back on the offline
 * queue's null result. The replay is idempotent by item id; on a refusal the
 * item still exists server-side, so a refetch restores it.
 */

import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveItemFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { removeFromShoppingListItemsCache } from './utils';
import { errorService } from '#/services/errorService';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import type { ShoppingList } from '#/graphql/generated/schemaTypes';

// Minimal cache-read fragments — only the fields the optimistic-update path needs.
const ShoppingListStatsFragment = gql`
  fragment _RemoveShoppingItemStats on ShoppingList {
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

const ShoppingListItemPurchaseFragment = gql`
  fragment _RemoveShoppingItemPurchase on ShoppingListItem {
    purchaseInfo {
      isPurchased
    }
  }
`;

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
    update(cache, { data }, { variables }) {
      // Re-evict on the server response: Apollo re-normalizes the
      // `shoppingListItem { id }` payload, resurrecting the evicted entity.
      if (!appliedPayload(data) || !listId || !variables) return;
      try {
        removeFromShoppingListItemsCache(cache, listId, variables.input.id, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache cleanup failed for removeItem:',
        });
      }
    },
  });

  const removeItem = async (itemId: string): Promise<boolean> => {
    if (!listId) return false;

    // Snapshot stats + purchased state to compute the decremented aggregates.
    const listCacheId = client.cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });
    const listStats = client.cache.readFragment<ListStats>({
      id: listCacheId,
      fragment: ShoppingListStatsFragment,
      fragmentName: '_RemoveShoppingItemStats',
      returnPartialData: true,
    });
    const itemPurchase = client.cache.readFragment<{
      purchaseInfo: { isPurchased: boolean } | null;
    }>({
      id: client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      }),
      fragment: ShoppingListItemPurchaseFragment,
      fragmentName: '_RemoveShoppingItemPurchase',
    });

    // Resolved before the try: value blocks inside one bail the React Compiler.
    const nextStats = statsWithoutRow(
      listStats,
      itemPurchase?.purchaseInfo?.isPurchased ?? false,
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
          context: { localFirst: true },
        }),
      {
        document: RemoveItemFromShoppingListDocument,
        fallback: t('errors.deleteItemFailed'),
        removal: true,
        // The item still exists server-side; a refetch restores it and its counts.
        onFailed: () => {
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

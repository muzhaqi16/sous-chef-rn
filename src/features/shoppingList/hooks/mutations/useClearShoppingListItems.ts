/**
 * Local-first: the items are evicted from the cache PERMANENTLY before the single
 * batch remove fires, so the clear survives an offline queue.
 */

import { useRef } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import {
  RemoveItemsFromShoppingListDocument,
  type RemoveItemsFromShoppingListMutationVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import {
  clearAllPurchasedItemsFromCache,
  clearAllUnpurchasedItemsFromCache,
} from '#features/shoppingList/cache/connections';

// Just the subset of Apollo's mutate options this hook ever passes.
type ClearMutationFn = (options: {
  variables: RemoveItemsFromShoppingListMutationVariables;
  update?: () => void;
  context?: { localFirst: boolean };
}) => Promise<{ data?: unknown; error?: unknown }>;

// The hook only reads `id` and the array length from the item lists.
interface ClearableItem {
  id: string;
}

interface UseClearShoppingListItemsOptions {
  listId: string | null | undefined;
  unpurchasedItems: ClearableItem[];
  purchasedItems: ClearableItem[];
  refetch: () => Promise<unknown>;
}

async function executeClearItems(
  client: ApolloClient,
  clearMutation: ClearMutationFn,
  listId: string,
  purchased: boolean,
  itemIds: string[],
  refetch: () => Promise<unknown>,
  failureMessage: string,
): Promise<void> {
  if (purchased) {
    clearAllPurchasedItemsFromCache(client.cache, listId, itemIds);
  } else {
    clearAllUnpurchasedItemsFromCache(client.cache, listId, itemIds);
  }

  // The EXACT ids captured at tap time, not a purchased filter: a queued replay
  // then deletes only those and never a row another member added meanwhile.
  // Removing an already-removed id is a server-side no-op, so the replay is safe.
  const settled = await settleMutation(
    () =>
      clearMutation({
        variables: { input: { shoppingListId: listId, ids: itemIds } },
        update: () => {}, // Cache already cleared optimistically
        context: { localFirst: true },
      }),
    { document: RemoveItemsFromShoppingListDocument, fallback: failureMessage },
  );

  // A queued clear keeps the cleared cache and replays later. A failure means
  // the items still exist server-side, so the refetch restores them.
  if (settled.status === 'failed') await refetch();
}

export function useClearShoppingListItems({
  listId,
  unpurchasedItems,
  purchasedItems,
  refetch,
}: UseClearShoppingListItemsOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const isClearingRef = useRef(false);

  const [clearMutation] = useMutation(RemoveItemsFromShoppingListDocument, {});

  const clearItems = async (purchased: boolean) => {
    if (!listId || isClearingRef.current) return;

    const targetItems = purchased ? purchasedItems : unpurchasedItems;
    if (targetItems.length === 0) return;

    isClearingRef.current = true;
    const itemIds = targetItems.map(i => i.id);

    await executeClearItems(
      client,
      clearMutation,
      listId,
      purchased,
      itemIds,
      refetch,
      t('shoppingListScreens.failedToClear'),
    );
    isClearingRef.current = false;
  };

  return { clearItems };
}

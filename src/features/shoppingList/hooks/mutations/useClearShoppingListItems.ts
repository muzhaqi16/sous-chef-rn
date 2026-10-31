/**
 * Local-first: the rows are hidden until the server answers the single batch
 * remove, so the clear survives an offline queue.
 */

import { useRef } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import {
  RemoveItemsFromShoppingListDocument,
  type RemoveItemsFromShoppingListMutationVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  pendingWritesOf,
  type LocalWriteSend,
} from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import type { RemoveRowsInputs } from '#features/shoppingList/offline/localWrites';

// Just the subset of Apollo's mutate options this hook ever passes.
type ClearMutationFn = (
  options: LocalWriteSend<RemoveItemsFromShoppingListMutationVariables>,
) => Promise<{ data?: unknown; error?: unknown }>;

// The hook only reads `id` and the array length from the item lists.
interface ClearableItem {
  id: string;
}

interface UseClearShoppingListItemsOptions {
  listId: string | null | undefined;
  unpurchasedItems: ClearableItem[];
  purchasedItems: ClearableItem[];
}

async function executeClearItems(
  client: ApolloClient,
  clearMutation: ClearMutationFn,
  listId: string,
  itemIds: string[],
  failureMessage: string,
): Promise<void> {
  const inputs: RemoveRowsInputs = { listId };
  // The EXACT ids captured at tap time, not a purchased filter: a queued replay
  // then deletes only those and never a row another member added meanwhile.
  // Removing an already-removed id is a server-side no-op, so the replay is safe.
  await pendingWritesOf(client.cache).send(
    RemoveItemsFromShoppingListDocument,
    { input: { shoppingListId: listId, ids: itemIds } },
    write =>
      settleMutation(() => clearMutation(write), {
        document: RemoveItemsFromShoppingListDocument,
        fallback: failureMessage,
      }),
    inputs,
  );
}

export function useClearShoppingListItems({
  listId,
  unpurchasedItems,
  purchasedItems,
}: UseClearShoppingListItemsOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const isClearingRef = useRef(false);

  const [clearMutation] = useMutation(RemoveItemsFromShoppingListDocument, {
    context: { localFirst: true },
  });

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
      itemIds,
      t('shoppingListScreens.failedToClear'),
    );
    isClearingRef.current = false;
  };

  return { clearItems };
}

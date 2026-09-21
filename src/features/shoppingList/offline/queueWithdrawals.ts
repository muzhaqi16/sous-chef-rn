/**
 * What the shopping list has to put back when a queued write is permanently
 * rejected. A move unlinks or stamps the row, and an evict of the pantry row it
 * created does not restore that half.
 */
import { gql } from '@apollo/client';
import { restoreItemToShoppingListAfterMoveToPantry } from '#features/shoppingList/cache/moveToPantry';
import { revertOptimisticShoppingListItem } from '#features/shoppingList/cache/items';
import { writePurchaseInfo } from '#features/shoppingList/cache/purchase';
import type {
  CountWithdrawalTable,
  UnlinkWithdrawalTable,
} from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';

export const restoreMovedShoppingListItem: UnlinkWithdrawalTable[string] = (
  cache,
  variables,
) => {
  const input = variables.input as
    | { shoppingListItemId?: string; removeFromList?: boolean | null }
    | undefined;
  if (!input?.shoppingListItemId) return;
  // A kept line was stamped, not unlinked. Its pre-move flag is not recorded,
  // so the withdrawal's reread brings `isPurchased` back from the server.
  if (input.removeFromList === false) {
    writePurchaseInfo(cache, input.shoppingListItemId, {
      movedToPantryAt: null,
    });
    return;
  }
  restoreItemToShoppingListAfterMoveToPantry(cache, input.shoppingListItemId);
};

const QUEUED_ROW_FRAGMENT = gql`
  fragment QueuedShoppingRow on ShoppingListItem {
    id
  }
`;

/**
 * A refused batch add minted every row in `input.items` and counted each one;
 * the failure handler's evict reaches only the first. A row already gone was
 * already uncounted.
 */
export const withdrawAddedShoppingListItems: CountWithdrawalTable[string] = (
  cache,
  variables,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input)) return;
  const { shoppingListId, items } = input;
  if (typeof shoppingListId !== 'string' || !Array.isArray(items)) return;

  for (const row of items) {
    if (!isRecord(row) || typeof row.id !== 'string') continue;
    const cached = cache.readFragment({
      id: cache.identify({ __typename: 'ShoppingListItem', id: row.id }),
      fragment: QUEUED_ROW_FRAGMENT,
    });
    if (!cached) continue;
    revertOptimisticShoppingListItem(cache, shoppingListId, row.id);
  }
};

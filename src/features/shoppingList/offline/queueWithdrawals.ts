/**
 * What the shopping list has to put back when a queued write is permanently
 * rejected. A move unlinks or stamps the row, and an evict of the pantry row it
 * created does not restore that half.
 */
import { restoreItemToShoppingListAfterMoveToPantry } from '#features/shoppingList/cache/moveToPantry';
import { withdrawShoppingListItems } from '#features/shoppingList/cache/withdraw';
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

  const ids = items.flatMap((row: unknown) =>
    isRecord(row) && typeof row.id === 'string' ? [row.id] : [],
  );
  withdrawShoppingListItems(cache, shoppingListId, ids);
};

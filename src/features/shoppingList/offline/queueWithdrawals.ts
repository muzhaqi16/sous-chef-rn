/**
 * What the shopping list has to put back when a queued write is permanently
 * rejected. A move unlinks or stamps the row, and an evict of the pantry row it
 * created does not restore that half.
 */
import { restoreItemToShoppingListAfterMoveToPantry } from '#features/shoppingList/cache/moveToPantry';
import { writePurchaseInfo } from '#features/shoppingList/cache/purchase';
import type { UnlinkWithdrawalTable } from '#/apollo/offlineQueue/types';

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

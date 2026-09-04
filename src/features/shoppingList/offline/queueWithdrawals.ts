/**
 * What the shopping list has to put back when a queued write is permanently
 * rejected. A move unlinks the row from its list, and an evict of the pantry
 * row it created does not restore that half.
 */
import { restoreItemToShoppingListAfterMoveToPantry } from '#features/shoppingList/cache/moveToPantry';
import type { UnlinkWithdrawalTable } from '#/apollo/offlineQueue/types';

export const SHOPPING_LIST_UNLINK_WITHDRAWALS: UnlinkWithdrawalTable = {
  MoveShoppingItemToPantry: (cache, variables) => {
    const input = variables.input as
      | { shoppingListItemId?: string; removeFromList?: boolean | null }
      | undefined;
    if (!input?.shoppingListItemId) return;
    // `removeFromList: false` never unlinked anything.
    if (input.removeFromList === false) return;
    restoreItemToShoppingListAfterMoveToPantry(cache, input.shoppingListItemId);
  },
};

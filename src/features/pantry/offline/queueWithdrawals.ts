/**
 * What the pantry has to un-count when a queued write is permanently rejected.
 * A queued create adjusts `Pantry.stats.totalItems` itself, because the
 * mutation's `update` callback never runs while it sits in the queue.
 */
import { removePantryItemLocally } from '#features/pantry/cache/items';
import type { CountWithdrawalTable } from '#/apollo/offlineQueue/types';

export const PANTRY_COUNT_WITHDRAWALS: CountWithdrawalTable = {
  CreatePantryItem: (cache, variables, entityId) => {
    const pantryId = (variables.input as { pantryId?: string } | undefined)
      ?.pantryId;
    if (!pantryId || !entityId) return;
    removePantryItemLocally(cache, pantryId, entityId);
  },
  MoveShoppingItemToPantry: (cache, variables, entityId) => {
    const input = variables.input as
      | { pantryId?: string; pantryItemId?: string }
      | undefined;
    const pantryId = input?.pantryId;
    const rowId = input?.pantryItemId ?? entityId;
    if (!pantryId || !rowId) return;
    removePantryItemLocally(cache, pantryId, rowId);
  },
};

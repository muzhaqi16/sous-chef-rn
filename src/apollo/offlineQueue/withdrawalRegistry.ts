/**
 * Every feature that has something to withdraw when a queued write is
 * permanently rejected, keyed by the operation its document declares. Its own
 * list rather than a manifest field, for the same reason as {@link SYNC_REGISTRY}.
 */
import { byOperation } from '#/apollo/utils/documentOperation';
import {
  withdrawCreatedPantryItem,
  withdrawMovedPantryItem,
} from '#features/pantry/offline/queueWithdrawals';
import { restoreMovedShoppingListItem } from '#features/shoppingList/offline/queueWithdrawals';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { CountWithdrawalTable, UnlinkWithdrawalTable } from './types';

export const COUNT_WITHDRAWALS: CountWithdrawalTable = byOperation([
  [CreatePantryItemDocument, withdrawCreatedPantryItem],
  [MoveShoppingItemToPantryDocument, withdrawMovedPantryItem],
]);

export const UNLINK_WITHDRAWALS: UnlinkWithdrawalTable = byOperation([
  [MoveShoppingItemToPantryDocument, restoreMovedShoppingListItem],
]);

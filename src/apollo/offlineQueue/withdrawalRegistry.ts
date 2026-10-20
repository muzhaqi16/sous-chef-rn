/**
 * What each feature withdraws when a queued write is permanently rejected; its
 * own list, not a manifest field, as {@link REPLAY_PREPARATIONS} explains.
 */
import { byOperation } from '#/apollo/utils/documentOperation';
import {
  withdrawCreatedPantryItem,
  withdrawMovedPantryItem,
} from '#features/pantry/offline/queueWithdrawals';
import {
  restoreMovedShoppingListItem,
  withdrawAddedShoppingListItems,
} from '#features/shoppingList/offline/queueWithdrawals';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  restoreReceiptCheckInListLines,
  withdrawReceiptCheckIn,
} from '#features/receipts/offline/receiptCheckIn';
import { CreateReceiptCheckInDocument } from '#features/receipts/hooks/useReceiptCheckIn.generated';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { forEachBatchAdd } from './replayRegistry';
import type { CountWithdrawalTable, UnlinkWithdrawalTable } from './types';

export const COUNT_WITHDRAWALS: CountWithdrawalTable = byOperation([
  [CreatePantryItemDocument, withdrawCreatedPantryItem],
  [MoveShoppingItemToPantryDocument, withdrawMovedPantryItem],
  [CreateReceiptCheckInDocument, withdrawReceiptCheckIn],
  ...forEachBatchAdd(withdrawAddedShoppingListItems),
]);

export const UNLINK_WITHDRAWALS: UnlinkWithdrawalTable = byOperation([
  [MoveShoppingItemToPantryDocument, restoreMovedShoppingListItem],
  [CreateReceiptCheckInDocument, restoreReceiptCheckInListLines],
]);

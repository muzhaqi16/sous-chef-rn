/**
 * What each feature withdraws when a queued write is permanently rejected; its
 * own list, not a manifest field, as {@link REPLAY_PREPARATIONS} explains.
 */
import { byOperation } from '#/apollo/utils/documentOperation';
import {
  restoreReceiptCheckInListLines,
  withdrawReceiptCheckIn,
} from '#features/receipts/offline/receiptCheckIn';
import { CreateReceiptCheckInDocument } from '#features/receipts/hooks/useReceiptCheckIn.generated';
import type { CountWithdrawalTable, UnlinkWithdrawalTable } from './types';

export const COUNT_WITHDRAWALS: CountWithdrawalTable = byOperation([
  [CreateReceiptCheckInDocument, withdrawReceiptCheckIn],
]);

export const UNLINK_WITHDRAWALS: UnlinkWithdrawalTable = byOperation([
  [CreateReceiptCheckInDocument, restoreReceiptCheckInListLines],
]);

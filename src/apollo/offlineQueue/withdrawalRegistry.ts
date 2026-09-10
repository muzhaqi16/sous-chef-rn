/**
 * Every feature that has something to withdraw when a queued write is
 * permanently rejected. Its own list rather than a manifest field, for the same
 * reason as {@link SYNC_REGISTRY}: i18n iterates the static registry on the
 * LAUNCH PATH, so a manifest carrying these would pull the queue into it.
 */
import { PANTRY_COUNT_WITHDRAWALS } from '#features/pantry/offline/queueWithdrawals';
import { SHOPPING_LIST_UNLINK_WITHDRAWALS } from '#features/shoppingList/offline/queueWithdrawals';
import type { CountWithdrawalTable, UnlinkWithdrawalTable } from './types';

export const COUNT_WITHDRAWALS: CountWithdrawalTable = {
  ...PANTRY_COUNT_WITHDRAWALS,
};

export const UNLINK_WITHDRAWALS: UnlinkWithdrawalTable = {
  ...SHOPPING_LIST_UNLINK_WITHDRAWALS,
};

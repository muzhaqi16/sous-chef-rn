import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { removePantryItemLocally } from '#/apollo/utils/pantryCacheUpdaters';
import { restoreItemToShoppingListAfterMoveToPantry } from '#/apollo/utils/shoppingListCacheUpdaters';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';
import type { OperationVariables } from '@apollo/client';
import type { FailedMutationInfo } from '#/apollo/offlineQueue/types';

/**
 * Withdraws a locally-applied change the server has permanently rejected, and
 * says so.
 *
 * Local-first writes go to the cache before the mutation fires, so the change is
 * on screen from the moment it is made. When the queue gives up on it, nothing
 * used to happen: `queueManager` has always exposed `setFailureHandler` and
 * called it, but no handler was ever registered. The change stayed on screen and
 * stayed wrong — no error, no correction — and a refetch would eventually
 * contradict it without explanation, or offline never would.
 *
 * The withdrawal is an evict rather than a field-level revert, because the queue
 * keeps no pre-change snapshot to revert to. For a create — where the entity
 * only ever existed locally — the row correctly disappears. For an update, the
 * entity is dropped and the next read fetches the server's version, which is by
 * definition the truth the local change failed to become.
 *
 * An entity that cannot be identified (already evicted, or an operation with no
 * single entity) is skipped: there is nothing to withdraw, and the next refetch
 * heals it. The person is still told.
 */
/**
 * Withdrawals the generic evict cannot express.
 *
 * `safeEvict(entityType, entityId)` withdraws what a write CREATED. An
 * operation that also UNLINKED an existing entity — a move takes a row out of
 * one parent before the server has agreed — leaves that second half standing,
 * and no evict can put it back. Each entry undoes its own operation's unlink,
 * keyed by the operation name the queue recorded.
 *
 * Keep every entry IDEMPOTENT: a withdrawal can run after a revert the call
 * site already performed, when the write failed while the screen was still open.
 */
const UNLINK_WITHDRAWALS: Record<
  string,
  (variables: OperationVariables) => void
> = {
  MoveShoppingItemToPantry: variables => {
    const input = variables.input as
      | { shoppingListItemId?: string; removeFromList?: boolean | null }
      | undefined;
    if (!input?.shoppingListItemId) return;
    // `removeFromList: false` never unlinked anything.
    if (input.removeFromList === false) return;
    restoreItemToShoppingListAfterMoveToPantry(
      client.cache,
      input.shoppingListItemId,
    );
  },
};

/**
 * Aggregates the eager write moved that the generic evict does not put back.
 *
 * A local-first pantry write adjusts `Pantry.stats.totalItems` when it
 * publishes its row, because the mutation's `update` callback never runs while
 * the write is queued. Every FOREGROUND rejection path pairs that with a
 * withdrawal; this path — the REPLAY refused permanently — did not, so the row
 * disappeared and the header went on counting it, with no response coming to
 * correct it offline.
 *
 * Runs BEFORE the evict, so the paired helper can still see the edge it is
 * uncounting and stays idempotent on a re-run.
 */
const COUNT_WITHDRAWALS: Record<
  string,
  (variables: OperationVariables, entityId: string | null) => void
> = {
  CreatePantryItem: (variables, entityId) => {
    const pantryId = (variables.input as { pantryId?: string } | undefined)
      ?.pantryId;
    if (!pantryId || !entityId) return;
    removePantryItemLocally(client.cache, pantryId, entityId);
  },
  MoveShoppingItemToPantry: (variables, entityId) => {
    const input = variables.input as
      | { pantryId?: string; pantryItemId?: string }
      | undefined;
    const pantryId = input?.pantryId;
    const rowId = input?.pantryItemId ?? entityId;
    if (!pantryId || !rowId) return;
    removePantryItemLocally(client.cache, pantryId, rowId);
  },
};

export function handleQueueFailure(info: FailedMutationInfo): void {
  const { mutationId, entityType, entityId, operationName, error } = info;

  logger.warn(
    `Queue: withdrawing locally-applied ${operationName} after permanent failure`,
    { entityType, entityId, code: error.code, type: error.type },
  );

  const withdrawCount = COUNT_WITHDRAWALS[operationName];
  if (withdrawCount) {
    try {
      withdrawCount(info.variables, entityId);
    } catch (countError) {
      logger.warn(
        `Queue: could not withdraw ${operationName}'s count`,
        countError,
      );
    }
  }

  if (entityType && entityId) {
    safeEvict(client.cache, entityType, entityId);
    // Otherwise the optimistic value is replayed over the server's on the next
    // restoration pass and the change comes back from the dead.
    optimisticDataPersistence.clearEntity(entityType, entityId);
  }

  // The other half of the withdrawal: put back what the write unlinked. Runs
  // after the evict, so a move's pantry row is gone before its shopping row
  // returns and the item is never visible in both places at once.
  const withdrawUnlink = UNLINK_WITHDRAWALS[operationName];
  if (withdrawUnlink) {
    try {
      withdrawUnlink(info.variables);
    } catch (withdrawError) {
      logger.warn(
        `Queue: could not withdraw ${operationName}'s unlink`,
        withdrawError,
      );
    }
  }

  // The app's own words, not the server's: `error.message` is written for
  // developers and can carry operation names and identifiers.
  toastService.error(t('errors.queuedChangeRejected'));

  // The entry has been withdrawn, so it is no longer a record of anything. Left
  // in place it sits as FAILED until `cleanupTerminal` ages it out 24h later,
  // padding every drain scan and every persisted write in between.
  queueStore.removeMutation(mutationId);
}

/**
 * Registers {@link handleQueueFailure}. Called once, from `useStartupInit`.
 *
 * This is the ONLY registration. `setFailureHandler` is last-write-wins, and
 * App.tsx used to register a second handler at module scope; effects run after
 * imports, so this one always won and that one was dead code that read as live.
 */
export function registerQueueFailureHandler(): void {
  queueManager.setFailureHandler(handleQueueFailure);
}

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
 * `safeEvict` withdraws what a write CREATED; an operation that also UNLINKED
 * an existing entity leaves that half standing, and no evict puts it back.
 * Keep every entry IDEMPOTENT — a withdrawal can follow a revert the call site
 * already ran, when the write failed with the screen still open.
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
 * Aggregates the eager write moved that an evict does not put back: a queued
 * pantry write adjusts `Pantry.stats.totalItems` itself, because the mutation's
 * `update` callback never runs while it is queued. Runs BEFORE the evict, so
 * the paired helper can still see the edge it is uncounting.
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

/**
 * Withdraws a locally-applied change the server permanently rejected. An evict
 * rather than a field-level revert, because the queue keeps no pre-change
 * snapshot: a create's row disappears, an update's entity is dropped so the
 * next read refetches. An unidentifiable entity is skipped and heals on refetch.
 */
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

  // After the evict, so a move's pantry row is gone before its shopping row
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

  // Withdrawn, so it records nothing; left in place it would pad every drain
  // scan and persisted write until `cleanupTerminal` ages it out 24h later.
  queueStore.removeMutation(mutationId);
}

/**
 * The ONE registration of {@link handleQueueFailure}, from `useStartupInit`.
 * `setFailureHandler` is last-write-wins, and effects run after imports, so a
 * second registration at module scope elsewhere would silently be dead.
 */
export function registerQueueFailureHandler(): void {
  queueManager.setFailureHandler(handleQueueFailure);
}

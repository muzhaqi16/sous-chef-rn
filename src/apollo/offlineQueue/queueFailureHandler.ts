import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { COUNT_WITHDRAWALS, UNLINK_WITHDRAWALS } from './withdrawalRegistry';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';
import type { FailedMutationInfo } from '#/apollo/offlineQueue/types';

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
      withdrawCount(client.cache, info.variables, entityId);
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
      withdrawUnlink(client.cache, info.variables);
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

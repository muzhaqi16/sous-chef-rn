import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { COUNT_WITHDRAWALS, UNLINK_WITHDRAWALS } from './withdrawalRegistry';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';
import type {
  FailedMutationInfo,
  OverwrittenMutationInfo,
  QueueError,
} from '#/apollo/offlineQueue/types';

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
  // developers and can carry operation names and identifiers. A conflict gets
  // its own sentence — "someone got there first" is a different thing for the
  // user to know than "this failed".
  toastService.error(withdrawalMessage(error.type, entityType));

  // Withdrawn, so it records nothing; left in place it would pad every drain
  // scan and persisted write until `cleanupTerminal` ages it out 24h later.
  queueStore.removeMutation(mutationId);
}

/**
 * The server accepted the replay and kept its own value. Nothing is withdrawn —
 * the entry already dequeued as success — so this only tells the person, using
 * the same copy the withdrawal path uses for a conflict.
 */
export function reportQueueOverwrite(info: OverwrittenMutationInfo): void {
  logger.warn(`Queue: ${info.operationName} converged on the server's value`, {
    entityType: info.entityType,
    entityId: info.entityId,
  });
  toastService.error(withdrawalMessage('conflict', info.entityType));
}

/** Resolves the withdrawal toast, naming the entity where the map knows it. */
function withdrawalMessage(
  type: QueueError['type'],
  entityType: string | null,
): string {
  if (type !== 'conflict') return t('errors.queuedChangeRejected');
  if (!entityType) return t('errors.queuedChangeOverwritten');

  const resource = t(`errors.resourceNames.${entityType}`, {
    defaultValue: '',
  });
  return resource
    ? t('errors.queuedChangeOverwrittenResource', { resource })
    : t('errors.queuedChangeOverwritten');
}

/**
 * The ONE registration of {@link handleQueueFailure}, from `useStartupInit`.
 * `setFailureHandler` is last-write-wins, and effects run after imports, so a
 * second registration at module scope elsewhere would silently be dead.
 */
export function registerQueueFailureHandler(): void {
  queueManager.setFailureHandler(handleQueueFailure);
  queueManager.setOverwriteReporter(reportQueueOverwrite);
}

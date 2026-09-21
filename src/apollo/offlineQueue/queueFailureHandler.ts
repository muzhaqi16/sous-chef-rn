import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { COUNT_WITHDRAWALS, UNLINK_WITHDRAWALS } from './withdrawalRegistry';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';
import { isTranslationKey, t } from '#/i18n';
import { logger } from '#/utils/environment';
import type {
  FailedMutationInfo,
  OverwrittenMutationInfo,
  QueueError,
} from '#/apollo/offlineQueue/types';

/**
 * Withdraws a locally-applied change the server permanently rejected. An evict
 * rather than a field-level revert, because the queue keeps no pre-change
 * snapshot: a create's row disappears, an update's entity is dropped and read
 * back from the server. An unidentifiable entity is skipped and heals the same way.
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
      errorService.reportError(countError, {
        operation: `Withdraw ${operationName}'s count`,
      });
    }
  }

  if (entityType && entityId) {
    safeEvict(client.cache, entityType, entityId);
    // Otherwise the optimistic value is replayed over the server's on the next
    // restoration pass and the change comes back from the dead.
    optimisticDataPersistence.clearEntity(entityType, entityId);
  } else if (entityId) {
    optimisticDataPersistence.clearEntityById(entityId);
  }

  // After the evict, so a move's pantry row is gone before its shopping row
  // returns and the item is never visible in both places at once.
  const withdrawUnlink = UNLINK_WITHDRAWALS[operationName];
  if (withdrawUnlink) {
    try {
      withdrawUnlink(client.cache, info.variables);
    } catch (withdrawError) {
      errorService.reportError(withdrawError, {
        operation: `Withdraw ${operationName}'s unlink`,
      });
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

  scheduleReread();
}

let rereadScheduled = false;
let rereadOwed = false;

/** Queued work the reread would overwrite: pending, or parked for re-auth. */
function hasQueuedWork(): boolean {
  const userId = queueStore.getCurrentUserId();
  if (!userId) return false;
  const { pending, authErrors } = queueStore.getQueueStats(userId);
  return pending > 0 || authErrors > 0;
}

function reread(): Promise<unknown> {
  rereadOwed = false;
  return client
    .refetchQueries({ include: 'active' })
    .catch((rereadError: unknown) => {
      errorService.reportError(rereadError, {
        operation: 'Re-read after a queue withdrawal',
      });
    });
}

/**
 * One read of the screens once the queue has drained: a refused update's row
 * is back with the server's value and a refused create's stays gone. The read
 * is network-only for every active query, so while any write is still queued
 * it is owed rather than run — it would put the server's older value over it.
 */
function scheduleReread(): void {
  if (rereadScheduled) return;
  rereadScheduled = true;
  queueManager
    .whenIdle()
    .then(() => {
      rereadScheduled = false;
      if (hasQueuedWork()) {
        rereadOwed = true;
        return;
      }
      return reread();
    })
    .catch((rereadError: unknown) => {
      rereadScheduled = false;
      errorService.reportError(rereadError, {
        operation: 'Re-read after a queue withdrawal',
      });
    });
}

/** A later pass emptied the queue: run the reread a withdrawal left owed. */
function onQueueDrained(): void {
  if (rereadOwed && !hasQueuedWork()) void reread();
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

  // A persisted entry's typename; only the loaded copy knows which have a name.
  const resourceKey = `errors.resourceNames.${entityType}`;
  return isTranslationKey(resourceKey)
    ? t('errors.queuedChangeOverwrittenResource', { resource: t(resourceKey) })
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
  queueManager.setDrainedHandler(onQueueDrained);
}

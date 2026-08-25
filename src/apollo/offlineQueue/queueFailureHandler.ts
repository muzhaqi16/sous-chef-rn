import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';
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
export function handleQueueFailure(info: FailedMutationInfo): void {
  const { mutationId, entityType, entityId, operationName, error } = info;

  logger.warn(
    `Queue: withdrawing locally-applied ${operationName} after permanent failure`,
    { entityType, entityId, code: error.code, type: error.type },
  );

  if (entityType && entityId) {
    safeEvict(client.cache, entityType, entityId);
    // Otherwise the optimistic value is replayed over the server's on the next
    // restoration pass and the change comes back from the dead.
    optimisticDataPersistence.clearEntity(entityType, entityId);
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

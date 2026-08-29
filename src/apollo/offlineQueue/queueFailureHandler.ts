import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { describesAChange } from '#/apollo/offlineQueue/queuedEntityIds';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { revertIntent } from '#/apollo/write/applyIntent';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';
import type { FailedMutationInfo } from '#/apollo/offlineQueue/types';

/**
 * Withdraws a locally-applied change the server has permanently rejected, and
 * says so — or, where the server resolved a conflict in its own favour, says
 * that instead and leaves its state in place.
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
 * That is the weaker outcome, and deliberately so for now: the house pattern
 * writes the cache permanently BEFORE firing, so by the time a mutation reaches
 * `queueLink` the preceding state is already gone — no snapshot can be taken
 * here. Restoring instead of dropping needs the write to carry a description of
 * what undoes it, computed at the call site when it applies the change. Until
 * then the evict is honest but blunt, and offline it has no repair: there is no
 * read that can bring the row back until the server is reachable. What this
 * function does guarantee is that no route gives up on a write silently.
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

  // A conflict is not a refusal of this write — the server took it, kept its
  // own value for the field, and returned that state, which Apollo has already
  // normalized. Evicting here would discard the truth rather than a stale
  // value, and offline there is no read that could bring the row back. Clear
  // the persisted optimistic value though, or the person's overwritten number
  // is re-applied over the server's on the next restoration pass.
  // Precise, not coarse: `type: 'conflict'` covers BOTH "the server applied
  // this write's arrival and returned its own state" (safe to leave — the
  // cache already holds the truth) and "the server REFUSED it on a stale
  // version and returned nothing" (must be undone — otherwise the refused
  // value stays on screen and in the persisted cache under a toast saying
  // someone else changed it). Only the first is tagged OVERWRITTEN.
  const overwritten = error.type === 'conflict' && error.code === 'OVERWRITTEN';

  // An intent knows exactly what this write changed, so the withdrawal can put
  // the prior values back. Without one there is no snapshot and the only honest
  // option is to drop the entity and let the next read replace it — which
  // offline cannot do, so the row simply disappears.
  // Not "are there intents?" but "do any of them describe anything?" — an
  // intent filed only to obtain the `localFirst` context undoes nothing, and
  // treating it as the undo silently skipped the evict that forces the row to
  // refetch the server's truth.
  const undoable = (info.intents ?? []).filter(describesAChange);

  if (undoable.length && !overwritten) {
    // Reverse order: the last change made is the first put back, so a write
    // that depended on an earlier one is undone while that one still stands.
    for (const intent of [...undoable].reverse()) {
      revertIntent(client.cache, intent);
    }
  } else if (entityType && entityId && !overwritten) {
    safeEvict(client.cache, entityType, entityId);
  }

  // The app's own words, not the server's: `error.message` is written for
  // developers and can carry operation names and identifiers. The two outcomes
  // read differently to the person — "we could not save this" versus "someone
  // else changed this first" — so they get different copy.
  toastService.error(
    t(
      overwritten
        ? 'errors.queuedChangeOverwritten'
        : 'errors.queuedChangeRejected',
    ),
  );

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

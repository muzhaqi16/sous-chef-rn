import type { ApolloCache } from '@apollo/client';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { entryIntents } from '#/apollo/offlineQueue/queuedEntityIds';
import { logger } from '#/utils/environment';
import { isAdjustBy, isPatchObject, refToCacheId } from './writeIntent';
import { reindexConnections } from './reindexConnections';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import type { FieldPatch } from './writeIntent';

/**
 * Re-apply the forward patch of every still-pending queued write to the cache.
 *
 * The queue is durable STRICTLY EARLIER than the cache is: `addMutation` writes
 * through to MMKV synchronously, while cache persistence is debounced and is
 * paused for as long as any pushed screen is up. So a kill in that window
 * leaves a restart with the write queued for replay but absent from the screen
 * — the change the person made is invisible until the network comes back.
 *
 * Restoring from the queue closes that window with the store that already had
 * to be durable, rather than with a third one whose job was only to be durable
 * sooner.
 *
 * Runs once at boot, not per screen: an intent names its own entity, so there
 * is nothing for a caller to enumerate and nothing to keep in step with the
 * typenames a screen happens to show.
 */
export function restorePendingIntents(cache: ApolloCache): number {
  // Every pending write, not one user's. This runs before Zustand has hydrated
  // so there is no user to ask, and the queue's own `CURRENT_USER_KEY` is
  // written only on a user CHANGE — so scoping by it silently restored nothing
  // for the ordinary case of a session that has been signed in for a while.
  // The cache does the scoping: it is cleared on sign-out, so a write belonging
  // to anyone else names an entity it does not contain, and the modify below is
  // a no-op for exactly that reason.
  const pending = queueStore.getAllPendingMutations();
  if (pending.length === 0) return 0;

  let restored = 0;

  cache.batch({
    update: batchCache => {
      for (const entry of pending) {
        for (const intent of entryIntents(entry)) {
          const lifecycle = intent.lifecycle ?? 'patch';

          // A create cannot be re-applied here: the COMPLETE entity is the
          // feature builder's to write, and the intent records only the undo.
          // Nothing is lost — the write is still queued — but the new row is
          // invisible until it replays.
          if (lifecycle === 'create') continue;

          // A removal has no patch, and skipping it was the defect: the
          // persisted cache still holds the row, so a delete made just before
          // a kill came BACK on screen and then vanished again when the queue
          // drained. Re-applying is idempotent — an already-absent row leaves
          // nothing to take out.
          if (lifecycle === 'remove') {
            if (intent.reindex) {
              reindexConnections(
                batchCache,
                intent.target,
                intent.reindex,
                'remove',
              );
            }
            safeEvict(batchCache, intent.target.__typename, intent.target.id);
            restored += 1;
            continue;
          }

          const id = refToCacheId(intent.target);
          // `cache.modify` silently ignores a modifier for a field the entity
          // does not have, so an entity the cache genuinely lost stays lost
          // rather than becoming a fragment of itself — the correct outcome,
          // since the replay still holds it.
          const fields = restorableFields(intent.patch);
          const moved = Boolean(intent.reindex);

          if (Object.keys(fields).length > 0) batchCache.modify({ id, fields });
          // Membership too, or a row restored as purchased still sits in the
          // unpurchased tab. Idempotent: the reindexer checks whether the edge
          // is already there before touching a variant.
          if (intent.reindex) {
            reindexConnections(
              batchCache,
              intent.target,
              intent.reindex,
              'patch',
            );
          }

          if (Object.keys(fields).length > 0 || moved) restored += 1;
        }
      }
    },
  });

  logger.info(`♻️ Restored ${restored} pending write(s) from the queue`);
  return restored;
}

/**
 * The fields of a patch that are safe to re-apply blind.
 *
 * Restoration cannot tell a cache that lost the write from one that persisted
 * it, so it must only re-apply what is IDEMPOTENT. An absolute value is: the
 * field ends up the same whether it was already there or not. A relative
 * adjustment is not — re-applying `adjustBy(-1)` on a cache that kept the
 * change subtracts twice, and inventing a quantity is worse than showing a
 * stale one that the replay is about to correct anyway.
 */
function restorableFields(
  patch: FieldPatch,
): Record<string, (existing: unknown) => unknown> {
  const fields: Record<string, (existing: unknown) => unknown> = {};

  for (const [name, value] of Object.entries(patch)) {
    if (isAdjustBy(value)) continue;
    // A nested patch names the object field and carries only the keys it
    // changed (`purchaseInfo.isPurchased`), so it merges rather than replaces.
    fields[name] = isPatchObject(value)
      ? existing =>
          isPatchObject(existing) ? { ...existing, ...value } : value
      : () => value;
  }

  return fields;
}

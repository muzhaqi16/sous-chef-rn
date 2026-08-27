import type { ApolloCache } from '@apollo/client';
import { PANTRY_SYNC_BUILDERS } from '#features/pantry/offline/syncBuilders';
import { SHOPPING_LIST_SYNC_BUILDERS } from '#features/shoppingList/offline/syncBuilders';
import type { QueuedMutation } from './types';
import type { SyncBuilderTable, SyncConversion } from './syncBuilder';
import { logger } from '#/utils/environment';

/**
 * Two-tier offline replay mapping.
 *
 * Entity create/update/delete/move ops are replayed through a dedicated `Sync*`
 * mutation that is idempotent by the client-minted cuid (which rides the replay
 * as `clientId`), so an online success and a queued replay converge on one row.
 * Everything else falls through to {@link convertToSyncMutation}'s default,
 * which re-sends the original mutation. That covers the granular pantry deltas
 * (restock / consume / waste / adjust / open-batch / convert-expired): they no
 * longer have `sync*` twins — instead each carries a client-minted
 * `input.idempotencyKey`, so re-sending the canonical mutation is itself
 * at-most-once (the server returns `ConflictError(code: IDEMPOTENT_REPLAY)` on a
 * replay, which the queue treats as converged). See docs/api/offline-sync.md.
 *
 * The builders themselves live with the features whose inputs they read — only
 * the feature knows what its mutation's variables mean. This module is the
 * dispatch: one static import per participating feature, composed into a data
 * table so adding a queued op is a one-line entry in that feature. The
 * imports are static rather than registered lazily because the queue must know
 * every replayable op before the first mutation, which no feature-mount-driven
 * registration can guarantee.
 */
const SYNC_REGISTRY: SyncBuilderTable = {
  ...PANTRY_SYNC_BUILDERS,
  ...SHOPPING_LIST_SYNC_BUILDERS,
};

/**
 * Whether an operation has a `Sync*` replay mapping. Used by queueLink as the
 * "replay-safe even without an explicit `context.localFirst` opt-in" half of
 * the offline queueing allowlist — these ops replay through idempotent
 * `Sync*` upserts, so queueing them can never ghost-duplicate.
 */
export function hasSyncMapping(operationName: string): boolean {
  return SYNC_REGISTRY[operationName] != null;
}

/** Every operation the queue can replay through a `Sync*` upsert. */
export function syncMappedOperations(): string[] {
  return Object.keys(SYNC_REGISTRY);
}

/**
 * Convert a queued mutation to its sync replay. Falls back to replaying the
 * original mutation for operations without a `Sync*` mapping (their server
 * create path is itself id-idempotent, so re-sending is duplicate-safe).
 */
export function convertToSyncMutation(
  mutation: QueuedMutation,
  cache: ApolloCache,
): SyncConversion {
  const build = SYNC_REGISTRY[mutation.operationName];
  if (build) {
    return build(mutation, cache);
  }

  logger.info(
    `ℹ️ Queue: No sync mutation for ${mutation.operationName}, using original mutation`,
  );
  return {
    syncMutation: mutation.mutation,
    syncVariables: mutation.variables,
  };
}

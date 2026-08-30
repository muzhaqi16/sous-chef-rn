import type { ApolloCache } from '@apollo/client';
import { PANTRY_SYNC_BUILDERS } from '#features/pantry/offline/syncBuilders';
import { SHOPPING_LIST_SYNC_BUILDERS } from '#features/shoppingList/offline/syncBuilders';
import type { QueuedMutation } from './types';
import type { SyncBuilderTable, SyncConversion } from './syncBuilder';
import { logger } from '#/utils/environment';

/**
 * Two-tier replay mapping: entity CRUD/move ops replay through a `Sync*`
 * mutation idempotent by the client-minted cuid, everything else re-sends the
 * original, made at-most-once by its own `input.idempotencyKey`. Imports are
 * STATIC — the queue must know every replayable op before the first mutation.
 */
const SYNC_REGISTRY: SyncBuilderTable = {
  ...PANTRY_SYNC_BUILDERS,
  ...SHOPPING_LIST_SYNC_BUILDERS,
};

/**
 * queueLink's "replay-safe without an explicit `context.localFirst` opt-in"
 * half of the allowlist: an idempotent `Sync*` upsert cannot ghost-duplicate.
 */
export function hasSyncMapping(operationName: string): boolean {
  return SYNC_REGISTRY[operationName] != null;
}

/** Every operation the queue can replay through a `Sync*` upsert. */
export function syncMappedOperations(): string[] {
  return Object.keys(SYNC_REGISTRY);
}

/**
 * Falls back to the original mutation when there is no `Sync*` mapping — those
 * server paths are id-idempotent, so re-sending is duplicate-safe.
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

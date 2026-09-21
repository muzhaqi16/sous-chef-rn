/**
 * Two-tier replay mapping: entity CRUD/move ops replay through a `Sync*`
 * mutation idempotent by the client-minted cuid, everything else re-sends the
 * original, made at-most-once by its own `input.idempotencyKey`. The
 * participating features are listed once in `syncRegistry.ts`.
 */
import type { ApolloCache } from '@apollo/client';
import { SYNC_REGISTRY } from './syncRegistry';
import type { QueuedMutation, ReplayInputs } from './types';
import type { SyncConversion } from './syncBuilder';
import { logger } from '#/utils/environment';

/**
 * queueLink's "replay-safe without an explicit `context.localFirst` opt-in"
 * half of the allowlist: an idempotent `Sync*` upsert cannot ghost-duplicate.
 */
export function hasSyncMapping(operationName: string): boolean {
  return SYNC_REGISTRY[operationName] != null;
}

/**
 * Every operation the queue can replay through a `Sync*` upsert.
 * @internal Test seam: the queue invariant tests enumerate it.
 */
export function syncMappedOperations(): string[] {
  return Object.keys(SYNC_REGISTRY);
}

/**
 * The cache values a write's replay will read, taken while its row is still
 * cached. Undefined for an operation whose replay reads nothing.
 */
export function captureReplayInputs(
  mutation: QueuedMutation,
  cache: ApolloCache,
): ReplayInputs | undefined {
  const inputs = SYNC_REGISTRY[mutation.operationName]?.captureReplayInputs?.(
    mutation,
    cache,
  );
  return inputs && Object.keys(inputs).length > 0 ? inputs : undefined;
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

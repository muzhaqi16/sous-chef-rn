import type { DocumentNode } from 'graphql';
import type { OperationVariables } from '@apollo/client';
import type { QueuedMutation } from './types';

/** The mutation a replay sends, and with what variables. */
export interface SyncConversion {
  syncMutation: DocumentNode;
  syncVariables: OperationVariables;
}

/**
 * What the queue sends when it replays an entry.
 *
 * It sends the SAME mutation the app would have sent immediately. There is no
 * longer a translation step, because there is no longer anything to translate
 * into: the API made every queued operation replay-safe on its canonical
 * mutation — creates by their client-minted id, updates by an `idempotencyKey`
 * claimed before the version check, deletes by converging on an already-deleted
 * row — and deprecated the `Sync*` twins that existed only because it could
 * not.
 *
 * That removes the layer's real cost, which was never its size: a replayed
 * write used to travel a DIFFERENT code path from the one every online write
 * takes, so replay-only bugs could not be caught by exercising the app online.
 *
 * Kept as a function rather than inlined at the call site so the queue has one
 * named place describing what a replay is, and so re-introducing a divergence
 * would have to be a deliberate edit here.
 */
export function convertToSyncMutation(
  mutation: QueuedMutation,
): SyncConversion {
  return {
    syncMutation: mutation.mutation,
    syncVariables: mutation.variables,
  };
}

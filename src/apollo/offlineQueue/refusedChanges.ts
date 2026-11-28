import { requireApolloClient } from '#apollo/clientRegistry';
import { pendingWritesOf } from '#apollo/pendingWrites/pendingWrites';
import { TopLevelErrorCode } from '#graphql/generated/schemaTypes';
import { queueManager } from './queueManager';
import { queueStore } from './queueStore';
import type { QueueError } from './types';

/** The row is gone, so a retry could never land. */
export const namesNoRow = (error: QueueError | undefined): boolean =>
  error?.code === 'NotFoundError' ||
  error?.code === TopLevelErrorCode.ResourceNotFound;

/** The person may not make this change, so a retry could never land either. */
export const deniesAccess = (error: QueueError | undefined): boolean =>
  error?.code === 'ForbiddenError' ||
  error?.code === TopLevelErrorCode.Forbidden;

/**
 * Shows the change again at once, and resolves when the queue has sent it
 * against the row as it stands, or could not.
 */
export async function retryRefusedChange(id: string): Promise<void> {
  pendingWritesOf(requireApolloClient().cache).reopen(queueStore.reopen(id));
  queueManager.drainAfterPass();
  await queueManager.whenIdle();
}

export function discardRefusedChange(id: string): void {
  queueStore.discard(id);
}

import { errorService } from '#/services/errorService';
import { GONE_REPLAYS, REPLAY_RECONCILERS } from './replayRegistry';
import type { OperationVariables } from '@apollo/client';
import { getApolloClient } from '#/apollo/clientRegistry';
import type { ReplayReconcilerTable } from './types';

/**
 * Never throws: a reconciliation failure must not turn a replay the server
 * accepted into a queue failure that then withdraws the change. Returns
 * whether `table` lists the operation.
 */
function runReconciler(
  table: ReplayReconcilerTable,
  operationName: string,
  variables: OperationVariables,
  data: unknown,
): boolean {
  const reconcile = table[operationName];
  if (!reconcile) return false;
  const client = getApolloClient();
  if (!client) return true;
  try {
    reconcile(client.cache, variables, data);
  } catch (error) {
    errorService.reportError(error, {
      operation: `Queue replay reconciliation failed for ${operationName}`,
    });
  }
  return true;
}

export function reconcileReplaySuccess(
  operationName: string,
  variables: OperationVariables,
  data: unknown,
): void {
  runReconciler(REPLAY_RECONCILERS, operationName, variables, data);
}

/**
 * Settles a replay answered "not found" whose operation lists that as moot.
 * Returns false when the operation does not, so the refusal stands.
 */
export const settleGoneReplay = (
  operationName: string,
  variables: OperationVariables,
): boolean => runReconciler(GONE_REPLAYS, operationName, variables, undefined);

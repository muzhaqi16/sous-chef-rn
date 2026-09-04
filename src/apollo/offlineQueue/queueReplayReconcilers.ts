import { errorService } from '#/services/errorService';
import { REPLAY_RECONCILERS } from './replayRegistry';
import type { OperationVariables } from '@apollo/client';
import { getApolloClient } from '#/apollo/clientRegistry';

/**
 * Never throws: a reconciliation failure must not turn a replay the server
 * accepted into a queue failure that then withdraws the change.
 */
export function reconcileReplaySuccess(
  operationName: string,
  variables: OperationVariables,
  data: unknown,
): void {
  const reconcile = REPLAY_RECONCILERS[operationName];
  if (!reconcile) return;
  const client = getApolloClient();
  if (!client) return;
  try {
    reconcile(client.cache, variables, data);
  } catch (error) {
    errorService.reportError(error, {
      operation: `Queue replay reconciliation failed for ${operationName}`,
    });
  }
}

import { errorService } from '#/services/errorService';
import {
  GONE_REPLAYS,
  MERGED_QUANTITY_OVERWRITES,
  REPLAY_RECONCILERS,
} from './replayRegistry';
import { isRecord } from '#/utils/isRecord';
import type { OperationVariables } from '@apollo/client';
import { getApolloClient } from '#/apollo/clientRegistry';
import type { ReplayReconcilerTable, RowAdoption } from './types';

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
  adopt?: (adoption: RowAdoption) => void,
): boolean {
  const reconcile = table[operationName];
  if (!reconcile) return false;
  const client = getApolloClient();
  if (!client) return true;
  try {
    reconcile(client.cache, variables, data, adopt);
  } catch (error) {
    errorService.reportError(error, {
      operation: `Queue replay reconciliation failed for ${operationName}`,
    });
  }
  return true;
}

/** A create the server merged is reported through `adopt`. */
export function reconcileReplaySuccess(
  operationName: string,
  variables: OperationVariables,
  data: unknown,
  adopt?: (adoption: RowAdoption) => void,
): void {
  runReconciler(REPLAY_RECONCILERS, operationName, variables, data, adopt);
}

/**
 * Settles a replay answered "not found" whose operation lists that as moot.
 * Returns false when the operation does not, so the refusal stands.
 */
export const settleGoneReplay = (
  operationName: string,
  variables: OperationVariables,
): boolean => runReconciler(GONE_REPLAYS, operationName, variables, undefined);

/** Whether a queued write overwrites the quantity a merged create combined. */
export const overwritesMergedQuantity = ({
  operationName,
  variables,
}: {
  operationName: string;
  variables: OperationVariables;
}): boolean => {
  const overwrites = MERGED_QUANTITY_OVERWRITES[operationName];
  const input: unknown = variables.input;
  return overwrites !== undefined && isRecord(input) && overwrites(input);
};

import { client } from '#/apollo/client';
import {
  addPantryItemLocally,
  removePantryItemLocally,
} from '#/apollo/utils/pantryCacheUpdaters';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { errorService } from '#/services/errorService';
import type { OperationVariables } from '@apollo/client';

/**
 * Settles a replay the server ACCEPTED but resolved differently than the local
 * write assumed. A replay runs with no `update` callback, so normalization is
 * all it gets — not enough when the server may answer with a DIFFERENT row.
 * Every entry must be IDEMPOTENT: a drain can re-run one already settled.
 */
const REPLAY_RECONCILERS: Record<
  string,
  (variables: OperationVariables, data: unknown) => void
> = {
  /**
   * `pantryItemId` is a HINT, honoured only when the move creates a row: if the
   * pantry already stocks that catalog item the server restocks the existing
   * stack and returns ITS id, leaving the locally minted row a ghost edge that
   * 404s when tapped. Compare the returned `pantryItem.id` against the id sent.
   */
  MoveShoppingItemToPantry: (variables, data) => {
    const input = variables.input as
      | { pantryItemId?: string; pantryId?: string }
      | undefined;
    const mintedId = input?.pantryItemId;
    const pantryId = input?.pantryId;
    if (!mintedId || !pantryId) return;

    const payload = extractMutationPayload(data) as
      | { __typename?: string; pantryItem?: { id?: string } }
      | null
      | undefined;
    const serverId = payload?.pantryItem?.id;
    // No id back (a refusal, or a payload shape without one) means there is
    // nothing to compare — leave the row for the failure handler or a refetch.
    if (!serverId || serverId === mintedId) return;

    // Withdraw the ghost AND link the row the server returned; withdrawing
    // alone leaves the user with neither. Both helpers are membership-gated, so
    // a re-drain changes nothing.
    removePantryItemLocally(client.cache, pantryId, mintedId);
    addPantryItemLocally(client.cache, pantryId, {
      __typename: 'PantryItem',
      id: serverId,
    });
  },
};

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
  try {
    reconcile(variables, data);
  } catch (error) {
    errorService.reportError(error, {
      operation: `Queue replay reconciliation failed for ${operationName}`,
    });
  }
}

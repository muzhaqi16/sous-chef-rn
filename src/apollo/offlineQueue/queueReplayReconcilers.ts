import { client } from '#/apollo/client';
import {
  addPantryItemLocally,
  removePantryItemLocally,
} from '#/apollo/utils/pantryCacheUpdaters';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { errorService } from '#/services/errorService';
import type { OperationVariables } from '@apollo/client';

/**
 * Reconciliations a REPLAY has to perform that the foreground path already did.
 *
 * The mirror image of `UNLINK_WITHDRAWALS` in `queueFailureHandler`: that one
 * undoes a locally-applied change the server permanently rejected, this one
 * settles a change the server ACCEPTED but resolved differently than the local
 * write assumed.
 *
 * The queue replays through `client.mutate` with no `update` callback, so a
 * replayed mutation gets Apollo's normalization and nothing else. That is
 * enough whenever the server writes the row the client minted. It is not
 * enough when the server may legitimately answer with a DIFFERENT row —
 * which is exactly what `moveShoppingItemToPantry` does — and the foreground
 * path's own reconciliation (in `useMoveToPantry`) cannot run, because by
 * then the call has long since returned `'queued'`.
 *
 * Keyed by the operation name the queue recorded, and every entry must be
 * IDEMPOTENT: a drain can re-run one after the screen already settled it.
 */
const REPLAY_RECONCILERS: Record<
  string,
  (variables: OperationVariables, data: unknown) => void
> = {
  /**
   * `pantryItemId` is a HINT, honoured only when the move creates a row. If the
   * pantry already stocks that catalog item the server restocks the existing
   * stack and returns ITS id, so the row minted locally is a ghost — a
   * permanently unresolvable edge in `Pantry.itemsConnection` that 404s when
   * tapped. The contract says to tell the branches apart by comparing the
   * returned `pantryItem.id` against the id sent, which is what this does.
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

    // The server restocked a different row. Withdraw the ghost AND link the row
    // the server actually returned — the foreground path does both (it adds the
    // response's `pantryItem` to the connection), and withdrawing without
    // adding leaves the user with neither: the row the client minted is gone
    // and the row the server created was never linked.
    //
    // Both helpers are membership-gated, so a re-drain changes nothing.
    removePantryItemLocally(client.cache, pantryId, mintedId);
    addPantryItemLocally(client.cache, pantryId, {
      __typename: 'PantryItem',
      id: serverId,
    });
  },
};

/**
 * Run the reconciler for a successfully replayed mutation, if it has one.
 *
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

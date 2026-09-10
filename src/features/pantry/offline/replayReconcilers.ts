/**
 * Settling a pantry replay the server accepted but resolved to a DIFFERENT row
 * than the local write assumed.
 */
import {
  addPantryItemLocally,
  removePantryItemLocally,
} from '#features/pantry/cache/items';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';

export const PANTRY_REPLAY_RECONCILERS: ReplayReconcilerTable = {
  /**
   * `pantryItemId` is a HINT, honoured only when the move creates a row: if the
   * pantry already stocks that catalog item the server restocks the existing
   * stack and returns ITS id, leaving the locally minted row a ghost edge that
   * 404s when tapped. Compare the returned `pantryItem.id` against the id sent.
   */
  MoveShoppingItemToPantry: (cache, variables, data) => {
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
    removePantryItemLocally(cache, pantryId, mintedId);
    addPantryItemLocally(cache, pantryId, {
      __typename: 'PantryItem',
      id: serverId,
    });
  },
};

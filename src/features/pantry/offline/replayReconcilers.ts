/**
 * Settling a pantry replay the server accepted but resolved to a DIFFERENT row
 * than the local write assumed.
 */
import {
  addPantryItemLocally,
  removePantryItemLocally,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';
import type { ApolloCache } from '@apollo/client';

type Withdraw = (cache: ApolloCache, pantryId: string, itemId: string) => void;

/**
 * A replay whose payload names a different row than the one minted locally:
 * the ghost is withdrawn AND the server's row linked, since withdrawing alone
 * leaves neither. Both helpers are membership-gated, so a re-drain is a no-op.
 */
const adoptServerRow =
  (
    mintedKey: 'pantryItemId' | 'clientId',
    returnedKey: 'pantryItem' | 'item',
    withdraw: Withdraw,
  ): ReplayReconcilerTable[string] =>
  (cache, variables, data) => {
    const input: unknown = variables.input;
    if (!isRecord(input)) return;
    const mintedId = input[mintedKey];
    const { pantryId } = input;
    if (typeof mintedId !== 'string' || typeof pantryId !== 'string') return;

    const payload: unknown = extractMutationPayload(data);
    const returned = isRecord(payload) ? payload[returnedKey] : undefined;
    const serverId = isRecord(returned) ? returned.id : undefined;
    // No id back (a refusal, or a shape without one): nothing to compare.
    if (typeof serverId !== 'string' || !serverId || serverId === mintedId) {
      return;
    }

    withdraw(cache, pantryId, mintedId);
    addPantryItemLocally(cache, pantryId, {
      __typename: 'PantryItem',
      id: serverId,
    });
  };

/**
 * `pantryItemId` is a HINT, honoured only when the move creates a row: if the
 * pantry already stocks that catalog item the server restocks the existing
 * stack and returns ITS id, leaving the minted row a ghost that 404s when tapped.
 */
export const reconcileMoveToPantryReplay = adoptServerRow(
  'pantryItemId',
  'pantryItem',
  removePantryItemLocally,
);

/**
 * A queued create replays with `forceAdd`, so a stack for the same item and
 * unit that another member added meanwhile absorbs it under its own id.
 */
export const reconcileCreatePantryItemReplay = adoptServerRow(
  'clientId',
  'item',
  revertOptimisticPantryItem,
);

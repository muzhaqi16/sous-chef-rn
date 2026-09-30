/**
 * Settling a pantry replay the server accepted but resolved to a DIFFERENT row
 * than the local write assumed.
 */
import {
  addPantryItemLocally,
  carriesPantryCount,
  removePantryItemLocally,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';
import type { ApolloCache } from '@apollo/client';

type Withdraw = (
  cache: ApolloCache,
  pantryId: string,
  itemId: string,
  options: { countsSettled: boolean },
) => void;

/**
 * A replay whose payload names a different row than the one minted locally
 * (`outcome: MERGED`): the ghost is withdrawn AND the server's row linked, since
 * withdrawing alone leaves neither, and later writes move to it. Both helpers
 * are membership-gated, so a re-drain is a no-op.
 */
const adoptServerRow =
  (
    mintedKey: 'pantryItemId' | 'id',
    withdraw: Withdraw,
  ): ReplayReconcilerTable[string] =>
  (cache, variables, data, adopt) => {
    const input: unknown = variables.input;
    if (!isRecord(input)) return;
    const mintedId = input[mintedKey];
    const { pantryId } = input;
    if (typeof mintedId !== 'string' || typeof pantryId !== 'string') return;

    const payload: unknown = extractMutationPayload(data);
    const returned = isRecord(payload) ? payload.pantryItem : undefined;
    const serverId = isRecord(returned) ? returned.id : undefined;
    // No id back (a refusal, or a shape without one): nothing to compare.
    if (typeof serverId !== 'string' || !serverId || serverId === mintedId) {
      return;
    }

    // A document queued by an older build reads its pantry through the row;
    // one queued before either was returned carries no count.
    const countsSettled = [
      isRecord(payload) ? payload.pantry : undefined,
      isRecord(returned) ? returned.pantry : undefined,
    ].some(pantry => carriesPantryCount(pantry, pantryId));
    withdraw(cache, pantryId, mintedId, { countsSettled });
    addPantryItemLocally(
      cache,
      pantryId,
      { __typename: 'PantryItem', id: serverId },
      { countsSettled },
    );
    adopt?.({
      mintedId,
      survivingId: serverId,
      version:
        isRecord(returned) && typeof returned.version === 'number'
          ? returned.version
          : undefined,
    });
  };

/**
 * `pantryItemId` is a HINT, honoured only when the move creates a row: if the
 * pantry already stocks that catalog item the server restocks the existing
 * stack and returns ITS id, leaving the minted row a ghost that 404s when tapped.
 */
export const reconcileMoveToPantryReplay = adoptServerRow(
  'pantryItemId',
  removePantryItemLocally,
);

/**
 * A queued create replays with `forceAdd`, so a stack for the same item and
 * unit that another member added meanwhile absorbs it under its own id.
 */
export const reconcileCreatePantryItemReplay = adoptServerRow(
  'id',
  revertOptimisticPantryItem,
);

/**
 * An applied delete answers with its row's `{ id }`, which re-creates the entity
 * the local removal evicted; it goes again. A converged replay answers `null`.
 */
const settleDelete =
  (typename: string): ReplayReconcilerTable[string] =>
  (cache, variables) => {
    const input: unknown = variables.input;
    if (!isRecord(input)) return;
    if (typeof input.id === 'string') safeEvict(cache, typename, input.id);
  };

export const settlePantryItemDelete = settleDelete('PantryItem');
export const settlePantryDelete = settleDelete('Pantry');

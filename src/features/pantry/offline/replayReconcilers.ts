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
import { adoptServerEntityId, safeEvict } from '#/apollo/utils/cacheUpdaters';
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
 * A replay answering with another row than the minted one (`outcome: MERGED`):
 * the ghost is withdrawn AND the server's row linked, and later writes move to
 * it. Both helpers are membership-gated, so a re-drain is a no-op.
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

    const countsSettled =
      isRecord(payload) && carriesPantryCount(payload.pantry, pantryId);
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

const adoptCreatedRow = adoptServerRow('id', revertOptimisticPantryItem);

const idOf = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.id === 'string' ? value.id : undefined;

/**
 * A queued create replays with `forceAdd`, so a stack for the same item and
 * unit that another member added meanwhile absorbs it under its own id. A
 * typed item the server matched takes over from the one minted for it.
 */
export const reconcileCreatePantryItemReplay: ReplayReconcilerTable[string] = (
  cache,
  variables,
  data,
  adopt,
) => {
  adoptCreatedRow(cache, variables, data, adopt);
  const input: unknown = variables.input;
  const payload: unknown = extractMutationPayload(data);
  const pantryItem = isRecord(payload) ? payload.pantryItem : undefined;
  const servedItemId = isRecord(pantryItem) ? idOf(pantryItem.item) : undefined;
  const sent =
    isRecord(input) && isRecord(input.item) ? idOf(input.item.inline) : null;
  adoptServerEntityId(cache, 'Item', servedItemId, sent);
};

/** The stack a delta landed on: the payload's own, else its ledger row's. */
const stackOf = (payload: Record<string, unknown>): unknown => {
  if (isRecord(payload.pantryItem)) return payload.pantryItem;
  return isRecord(payload.pantryItemUsage)
    ? payload.pantryItemUsage.pantryItem
    : undefined;
};

/**
 * A delta queued against a stack the server has since merged into another
 * (USM-3) lands on the survivor, which the answer names. The merged row goes,
 * the survivor is linked, and later writes follow it through `adopt`: deltas
 * move, while a set or a removal is withdrawn, as for a merged create.
 */
const adoptSurvivorOfDelta =
  (subjectKey: 'id' | 'pantryItemId'): ReplayReconcilerTable[string] =>
  (cache, variables, data, adopt) => {
    const input: unknown = variables.input;
    const payload: unknown = extractMutationPayload(data);
    if (!isRecord(input) || !isRecord(payload)) return;
    const queuedId = input[subjectKey];
    const row = stackOf(payload);
    const servedId = idOf(row);
    if (typeof queuedId !== 'string' || !servedId || servedId === queuedId) {
      return;
    }

    const pantryId = idOf(payload.pantry);
    if (pantryId) {
      const countsSettled = carriesPantryCount(payload.pantry, pantryId);
      removePantryItemLocally(cache, pantryId, queuedId, {
        countsSettled,
        evictItem: true,
      });
      addPantryItemLocally(
        cache,
        pantryId,
        { __typename: 'PantryItem', id: servedId },
        { countsSettled },
      );
    } else {
      safeEvict(cache, 'PantryItem', queuedId);
    }
    adopt?.({
      mintedId: queuedId,
      survivingId: servedId,
      version:
        isRecord(row) && typeof row.version === 'number'
          ? row.version
          : undefined,
    });
  };

export const reconcilePantryUsageReplay = adoptSurvivorOfDelta('pantryItemId');
export const reconcileRestockReplay = adoptSurvivorOfDelta('id');
export const reconcileConvertExpiredReplay =
  adoptSurvivorOfDelta('pantryItemId');

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

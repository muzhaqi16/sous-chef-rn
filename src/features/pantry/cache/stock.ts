import type { ApolloCache } from '@apollo/client';
import { heldDisplayAmount } from '#domain/stockDisplay';
import {
  WriteHeldStock_PantryItemFragmentDoc,
  type WriteHeldStock_PantryItemFragment,
} from './stock.generated';

type ShownAmount = WriteHeldStock_PantryItemFragment['displayAmount'];

/**
 * The ONE writer of what a stack holds before the server answers: `heldQuantity`
 * and, with it, `displayAmount` in the unit the stack counts in, so a screen never
 * shows the server's "1 doz" over a stack that now holds 11. `shown` restores the
 * server's own display together with the amount it described. Returns the undo.
 */
export function writeHeldStock(
  cache: ApolloCache,
  pantryItemId: string,
  next: number | ((held: number) => number),
  shown?: ShownAmount,
): () => void {
  const id = cache.identify({ __typename: 'PantryItem', id: pantryItemId });
  if (!id) return () => {};
  const cached = cache.readFragment<WriteHeldStock_PantryItemFragment>({
    id,
    fragment: WriteHeldStock_PantryItemFragmentDoc,
    fragmentName: 'writeHeldStock_pantryItem',
    returnPartialData: true,
  });
  const held = cached?.heldQuantity ?? 0;
  const heldQuantity = typeof next === 'number' ? next : next(held);
  const unit = cached?.unit;
  if (!unit) {
    // No unit to show it in: the amount still moves.
    cache.modify({ id, fields: { heldQuantity: () => heldQuantity } });
    return () => cache.modify({ id, fields: { heldQuantity: () => held } });
  }
  cache.writeFragment({
    id,
    fragment: WriteHeldStock_PantryItemFragmentDoc,
    fragmentName: 'writeHeldStock_pantryItem',
    data: {
      __typename: 'PantryItem',
      id: pantryItemId,
      heldQuantity,
      unit,
      displayAmount: shown ?? heldDisplayAmount(heldQuantity, unit),
    },
  });
  const before = cached.displayAmount;
  return () => writeHeldStock(cache, pantryItemId, held, before);
}

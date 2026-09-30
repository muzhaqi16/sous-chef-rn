import type { ApolloCache } from '@apollo/client';
import { shownStock } from '#domain/stockDisplay';
import {
  WriteHeldStock_PantryItemFragmentDoc,
  WriteHeldStock_ShownInFragmentDoc,
  type WriteHeldStock_PantryItemFragment,
  type WriteHeldStock_ShownInFragment,
} from './stock.generated';

type ShownAmount = WriteHeldStock_PantryItemFragment['displayAmount'];
type CountedIn = WriteHeldStock_PantryItemFragment['unit'];

/** `heldQuantity` as the server will show it; in `unit` when the dozen is not cached. */
function shownAmount(
  cache: ApolloCache,
  id: string,
  heldQuantity: number,
  unit: CountedIn,
): ShownAmount {
  const shownIn = cache.readFragment<WriteHeldStock_ShownInFragment>({
    id,
    fragment: WriteHeldStock_ShownInFragmentDoc,
    fragmentName: 'writeHeldStock_shownIn',
  })?.displayUnit;
  const amount = shownStock(heldQuantity, unit, shownIn);
  return {
    __typename: 'DisplayAmount',
    quantity: amount.quantity,
    unit: {
      __typename: 'Unit',
      id: amount.unit.id,
      symbol: amount.unit.symbol,
    },
  };
}

/**
 * The ONE writer of what a stack holds before the server answers: `heldQuantity`
 * and, with it, `displayAmount` by the server's rule (`shownStock`), so a screen
 * never shows "1 doz" over a stack that now holds 11 pc. `shown` restores the
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
      displayAmount: shown ?? shownAmount(cache, id, heldQuantity, unit),
    },
  });
  const before = cached.displayAmount;
  return () => writeHeldStock(cache, pantryItemId, held, before);
}
